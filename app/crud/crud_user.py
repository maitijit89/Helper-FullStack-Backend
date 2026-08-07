from datetime import datetime, timedelta, timezone
from typing import List, Optional
from beanie import PydanticObjectId
from beanie.operators import Or
import secrets
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.location import GPSLocation, LocationUpdate
from app.schemas.partner import (
    PartnerCreate,
    PartnerProfile,
    PartnerUpdate,
    PartnerVerificationStatus,
)
from app.schemas.role import UserRole
from app.schemas.user import CustomerUserCreate, UserCreate, UserUpdate


class CRUDUser:
    async def get_by_id(self, user_id: str) -> Optional[User]:
        try:
            return await User.get(PydanticObjectId(user_id))
        except Exception:
            return None

    async def get_by_email(self, email: str) -> Optional[User]:
        return await User.find_one(User.email == email)

    async def get_by_partner_id(self, partner_id: str) -> Optional[User]:
        """Fetch delivery partner by unique Partner ID (e.g. PRT-892134)."""
        return await User.find_one(
            User.role == UserRole.PARTNER,
            User.partner_profile.partner_id == partner_id,
        )

    async def get_multi(
        self, role: Optional[UserRole] = None, skip: int = 0, limit: int = 100
    ) -> List[User]:
        query = User.find_all()
        if role:
            query = query.find(User.role == role)
        return await query.skip(skip).limit(limit).to_list()

    async def get_or_create_admin(self, email: str) -> User:
        """Fetch Admin user by email or create standard admin record if missing."""
        user = await self.get_by_email(email=email)
        if not user:
            user = User(
                email=email,
                hashed_password=get_password_hash(secrets.token_urlsafe(32)),
                full_name="System Administrator",
                role=UserRole.ADMIN,
                is_email_verified=True,
                is_active=True,
                is_superuser=True,
            )
            await user.insert()
        else:
            if user.role != UserRole.ADMIN or not user.is_superuser:
                user.role = UserRole.ADMIN
                user.is_superuser = True
                user.is_email_verified = True
                await user.save()
        return user

    async def create_customer(self, obj_in: CustomerUserCreate) -> User:
        raw_password = obj_in.password or secrets.token_urlsafe(16)
        user = User(
            email=obj_in.email,
            hashed_password=get_password_hash(raw_password),
            full_name=obj_in.name,
            dob=obj_in.dob,
            gender=obj_in.gender,
            phone=obj_in.phone,
            college=obj_in.college,
            address=obj_in.address,
            role=UserRole.USER,
            is_email_verified=False,
            is_active=True,
            is_superuser=False,
        )
        await user.insert()
        return user

    async def check_partner_cooldown(self, email: str, phone: str) -> Optional[User]:
        """Check if an application exists for this email/phone within the 7-day cooldown window."""
        existing_partner = await User.find_one(
            User.role == UserRole.PARTNER,
            Or(User.email == email, User.partner_profile.phone == phone),
        )
        if not existing_partner or not existing_partner.partner_profile:
            return None

        last_date = existing_partner.partner_profile.last_application_date
        if last_date:
            if last_date.tzinfo is None:
                last_date = last_date.replace(tzinfo=timezone.utc)
            cooldown_period = timedelta(days=7)
            if datetime.now(timezone.utc) - last_date < cooldown_period:
                return existing_partner
        return None

    async def create_partner_application(self, obj_in: PartnerCreate) -> User:
        """Create or update a pending delivery partner application."""
        now = datetime.now(timezone.utc)
        partner_profile = PartnerProfile(
            delivery_mode=obj_in.delivery_mode,
            college=obj_in.college,
            current_address=obj_in.current_address,
            permanent_address=obj_in.permanent_address,
            dob=obj_in.dob,
            phone=obj_in.phone,
            is_online=False,
            verification_status=PartnerVerificationStatus.PENDING,
            rejection_reason=None,
            last_application_date=now,
        )

        existing_user = await self.get_by_email(email=obj_in.email)
        dummy_password = secrets.token_urlsafe(16)
        if existing_user:
            existing_user.full_name = obj_in.name
            existing_user.phone = obj_in.phone
            existing_user.college = obj_in.college
            existing_user.address = obj_in.current_address
            existing_user.role = UserRole.PARTNER
            existing_user.partner_profile = partner_profile
            existing_user.touch()
            await existing_user.save()
            return existing_user

        user = User(
            email=obj_in.email,
            hashed_password=get_password_hash(dummy_password),
            full_name=obj_in.name,
            phone=obj_in.phone,
            college=obj_in.college,
            address=obj_in.current_address,
            role=UserRole.PARTNER,
            partner_profile=partner_profile,
            is_email_verified=True,
            is_active=True,
            is_superuser=False,
        )
        await user.insert()
        return user

    def _generate_partner_id(self) -> str:
        """Generate a random unique Partner ID like PRT-789123."""
        return f"PRT-{''.join(secrets.choice('0123456789') for _ in range(6))}"

    async def approve_partner(self, db_obj: User) -> tuple[User, str, str]:
        """Approve partner, generate unique Partner ID and initial password."""
        partner_id = self._generate_partner_id()
        initial_password = f"P@{secrets.choice('ABCDEFGH')}{secrets.randbelow(8999)+1000}"

        if db_obj.partner_profile:
            db_obj.partner_profile.partner_id = partner_id
            db_obj.partner_profile.verification_status = PartnerVerificationStatus.APPROVED
            db_obj.partner_profile.rejection_reason = None

        db_obj.hashed_password = get_password_hash(initial_password)
        db_obj.touch()
        await db_obj.save()

        return db_obj, partner_id, initial_password

    async def reject_partner(
        self, db_obj: User, reason: Optional[str] = None
    ) -> User:
        """Reject partner application with rejection reason."""
        if db_obj.partner_profile:
            db_obj.partner_profile.verification_status = PartnerVerificationStatus.REJECTED
            db_obj.partner_profile.rejection_reason = (
                reason or "Your application was rejected. Please try again after 7 days."
            )

        db_obj.touch()
        await db_obj.save()
        return db_obj

    async def change_password(self, db_obj: User, new_password: str) -> User:
        """Update user hashed password."""
        db_obj.hashed_password = get_password_hash(new_password)
        db_obj.touch()
        await db_obj.save()
        return db_obj

    async def mark_email_verified(self, db_obj: User) -> User:
        db_obj.is_email_verified = True
        db_obj.touch()
        await db_obj.save()
        return db_obj

    async def update_user(self, db_obj: User, obj_in: UserUpdate) -> User:
        update_data = obj_in.model_dump(exclude_unset=True)
        if "password" in update_data and update_data["password"]:
            hashed_password = get_password_hash(update_data["password"])
            del update_data["password"]
            db_obj.hashed_password = hashed_password

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db_obj.touch()
        await db_obj.save()
        return db_obj

    async def update_user_location(
        self, db_obj: User, location_in: LocationUpdate
    ) -> User:
        """Update current GPS location coordinates and active GPS state for user/partner."""
        gps_loc = GPSLocation(
            latitude=location_in.latitude,
            longitude=location_in.longitude,
            is_gps_enabled=location_in.is_gps_enabled,
            address=location_in.address,
            updated_at=datetime.now(timezone.utc),
        )
        db_obj.location = gps_loc
        db_obj.is_gps_enabled = location_in.is_gps_enabled
        db_obj.touch()
        await db_obj.save()
        return db_obj

    async def delete_user(self, db_obj: User) -> bool:
        """Permanently delete user document from MongoDB."""
        await db_obj.delete()
        return True

    async def update_partner_profile(
        self, db_obj: User, obj_in: PartnerUpdate
    ) -> User:
        if not db_obj.partner_profile:
            return db_obj

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj.partner_profile, field, value)

        db_obj.touch()
        await db_obj.save()
        return db_obj

    async def toggle_partner_online(
        self, db_obj: User, is_online: bool
    ) -> User:
        if db_obj.partner_profile:
            db_obj.partner_profile.is_online = is_online
            db_obj.touch()
            await db_obj.save()
        return db_obj

    async def get_partners_by_verification_status(
        self, status: PartnerVerificationStatus, skip: int = 0, limit: int = 100
    ) -> List[User]:
        return (
            await User.find(
                User.role == UserRole.PARTNER,
                User.partner_profile.verification_status == status,
            )
            .skip(skip)
            .limit(limit)
            .to_list()
        )

    async def authenticate(self, email: str, password: str) -> Optional[User]:
        user = await self.get_by_email(email=email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    async def authenticate_partner(
        self, partner_id_or_email: str, password: str
    ) -> Optional[User]:
        """Authenticate partner by either Partner ID or Email."""
        partner = await self.get_by_partner_id(partner_id=partner_id_or_email)
        if not partner:
            partner = await self.get_by_email(email=partner_id_or_email)

        if not partner or partner.role != UserRole.PARTNER:
            return None

        if not verify_password(password, partner.hashed_password):
            return None
        return partner


user_crud = CRUDUser()
