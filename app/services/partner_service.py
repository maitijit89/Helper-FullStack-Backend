from typing import Optional
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
)
from app.core.security import create_access_token, create_refresh_token, verify_password
from app.crud import user_crud
from app.models.user import User
from app.schemas.partner import (
    PartnerChangePassword,
    PartnerCreate,
    PartnerVerificationStatus,
)
from app.schemas.role import UserRole
from app.schemas.token import Token


class PartnerService:
    async def apply_partner(self, partner_in: PartnerCreate) -> User:
        """Submit delivery partner application with 7-day reapplication cooldown check."""
        cooldown_user = await user_crud.check_partner_cooldown(
            email=partner_in.email, phone=partner_in.phone
        )
        if cooldown_user:
            raise BadRequestException(
                "You have submitted an application within the last 7 days. Please wait 1 week before reapplying."
            )

        return await user_crud.create_partner_application(obj_in=partner_in)

    async def verify_partner(
        self, partner_user_id: str, status: PartnerVerificationStatus, rejection_reason: Optional[str] = None
    ) -> dict:
        """Admin verification endpoint: Approves or rejects partner application."""
        partner = await user_crud.get_by_id(user_id=partner_user_id)
        if not partner or partner.role != UserRole.PARTNER:
            raise NotFoundException("Delivery partner application not found.")

        if status == PartnerVerificationStatus.APPROVED:
            updated_partner, partner_id, initial_password = await user_crud.approve_partner(db_obj=partner)
            return {
                "partner": updated_partner,
                "partner_id": partner_id,
                "initial_password": initial_password,
                "message": f"Partner approved successfully! Assigned Partner ID: {partner_id}",
            }
        else:
            updated_partner = await user_crud.reject_partner(
                db_obj=partner, reason=rejection_reason
            )
            return {
                "partner": updated_partner,
                "partner_id": None,
                "initial_password": None,
                "message": "You are rejected. Try again later after 7 days.",
            }

    async def authenticate_partner(
        self, partner_id_or_email: str, password: str
    ) -> Token:
        """Authenticate delivery partner via Partner ID or Email."""
        partner = await user_crud.authenticate_partner(
            partner_id_or_email=partner_id_or_email, password=password
        )
        if not partner:
            raise UnauthorizedException("Incorrect Partner ID/Email or password.")

        if not partner.is_active:
            raise BadRequestException("Inactive partner account.")

        if (
            not partner.partner_profile
            or partner.partner_profile.verification_status != PartnerVerificationStatus.APPROVED
        ):
            status_val = partner.partner_profile.verification_status.value if partner.partner_profile else "pending"
            raise ForbiddenException(
                f"Partner application is not approved. Current status: '{status_val}'. Rejection info or wait period applies."
            )

        access_token = create_access_token(
            subject=str(partner.id), role=UserRole.PARTNER
        )
        refresh_token = create_refresh_token(
            subject=str(partner.id), role=UserRole.PARTNER
        )
        return Token(access_token=access_token, refresh_token=refresh_token)

    async def change_password(
        self, user: User, req: PartnerChangePassword
    ) -> User:
        """Change partner password verifying previous password."""
        if not verify_password(req.previous_password, user.hashed_password):
            raise BadRequestException("Previous password does not match.")

        if req.previous_password == req.new_password:
            raise BadRequestException("New password must be different from previous password.")

        return await user_crud.change_password(
            db_obj=user, new_password=req.new_password
        )


partner_service = PartnerService()
