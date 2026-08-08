from app.core.config import settings
from app.core.exceptions import BadRequestException, NotFoundException, UnauthorizedException
from app.core.security import create_access_token, create_refresh_token
from app.crud.crud_user import user_crud

from app.models.otp import OTP
from app.models.user import User
from app.schemas.auth_otp import OTPPurpose, OTPResponse
from app.schemas.partner import PartnerCreate
from app.schemas.role import UserRole
from app.schemas.token import Token
from app.schemas.user import CustomerUserCreate, UserCreate
from app.services.otp_service import otp_service


from app.services.google_sheets_service import google_sheets_service


class AuthService:
    async def register_customer(
        self, user_in: CustomerUserCreate
    ) -> tuple[User, OTP]:
        """Register a new customer with mandatory profile details and generate an email verification OTP."""
        existing_user = await user_crud.get_by_email(email=user_in.email)
        if existing_user:
            raise BadRequestException("A user with this email already exists.")

        user = await user_crud.create_customer(obj_in=user_in)

        # Sync user registration to Google Sheets
        try:
            await google_sheets_service.sync_new_user_registration(user)
        except Exception as e:
            pass

        otp = await otp_service.create_otp(
            email=user.email, purpose=OTPPurpose.VERIFICATION
        )
        return user, otp

    async def verify_registration_otp(self, email: str, code: str) -> Token:
        """Verify registration OTP, mark user email as verified, and issue JWT tokens."""
        user = await user_crud.get_by_email(email=email)
        if not user:
            raise NotFoundException("User not found.")

        await otp_service.verify_otp(
            email=email, code=code, purpose=OTPPurpose.VERIFICATION
        )
        updated_user = await user_crud.mark_email_verified(db_obj=user)

        # Sync user verification status to Google Sheets
        try:
            await google_sheets_service.sync_user_status_update(updated_user)
        except Exception as e:
            pass

        access_token = create_access_token(subject=str(updated_user.id), role=updated_user.role)
        refresh_token = create_refresh_token(subject=str(updated_user.id), role=updated_user.role)
        return Token(access_token=access_token, refresh_token=refresh_token)


    async def request_admin_otp(self, email: str) -> OTP:
        """Request Admin OTP for designated admin email."""
        if email.lower().strip() != settings.ADMIN_EMAIL.lower().strip():
            raise BadRequestException(
                f"Admin OTP login is restricted exclusively to designated email: {settings.ADMIN_EMAIL}"
            )

        admin = await user_crud.get_or_create_admin(email=email)
        if not admin.is_active:
            raise BadRequestException("Admin account is inactive.")

        return await otp_service.create_otp(
            email=admin.email, purpose=OTPPurpose.LOGIN
        )

    async def verify_admin_otp(self, email: str, code: str) -> Token:
        """Verify Admin OTP and issue Admin JWT tokens."""
        if email.lower().strip() != settings.ADMIN_EMAIL.lower().strip():
            raise BadRequestException(
                f"Admin verification is restricted exclusively to designated email: {settings.ADMIN_EMAIL}"
            )

        admin = await user_crud.get_or_create_admin(email=email)
        await otp_service.verify_otp(
            email=email, code=code, purpose=OTPPurpose.LOGIN
        )

        access_token = create_access_token(subject=str(admin.id), role=UserRole.ADMIN)
        refresh_token = create_refresh_token(subject=str(admin.id), role=UserRole.ADMIN)
        return Token(access_token=access_token, refresh_token=refresh_token)

    async def request_login_otp(self, email: str) -> OTP:
        """Generate a login OTP for a registered user."""
        user = await user_crud.get_by_email(email=email)
        if not user:
            raise NotFoundException(
                "No user account found registered with this email."
            )
        if not user.is_active:
            raise BadRequestException("User account is inactive.")

        return await otp_service.create_otp(
            email=email, purpose=OTPPurpose.LOGIN
        )

    async def verify_login_otp(self, email: str, code: str) -> Token:
        """Verify login OTP code and issue JWT tokens for app access."""
        user = await user_crud.get_by_email(email=email)
        if not user:
            raise NotFoundException("User account not found.")

        await otp_service.verify_otp(
            email=email, code=code, purpose=OTPPurpose.LOGIN
        )

        if not user.is_email_verified:
            await user_crud.mark_email_verified(db_obj=user)

        access_token = create_access_token(subject=str(user.id), role=user.role)
        refresh_token = create_refresh_token(subject=str(user.id), role=user.role)
        return Token(access_token=access_token, refresh_token=refresh_token)

    async def resend_otp(self, email: str, purpose: OTPPurpose) -> OTP:
        """Resend a new OTP for verification or login."""
        user = await user_crud.get_by_email(email=email)
        if not user:
            raise NotFoundException("User account not found.")
        return await otp_service.create_otp(email=email, purpose=purpose)

    async def register_partner(self, partner_in: PartnerCreate) -> User:
        existing_user = await user_crud.get_by_email(email=partner_in.email)
        if existing_user:
            raise BadRequestException("A user with this email already exists.")
        return await user_crud.create_partner(obj_in=partner_in)

    async def authenticate_user(self, email: str, password: str) -> Token:
        user = await user_crud.authenticate(email=email, password=password)
        if not user:
            raise UnauthorizedException("Incorrect email or password.")
        if not user.is_active:
            raise BadRequestException("Inactive user account.")

        access_token = create_access_token(subject=str(user.id), role=user.role)
        refresh_token = create_refresh_token(subject=str(user.id), role=user.role)
        return Token(access_token=access_token, refresh_token=refresh_token)


auth_service = AuthService()
