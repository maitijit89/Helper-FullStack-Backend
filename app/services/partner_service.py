from typing import Optional
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
)
from app.core.security import create_access_token, create_refresh_token, verify_password
from app.crud.crud_user import user_crud

from app.models.user import User
from app.schemas.partner import (
    AdminPartnerUpdate,
    PartnerChangePassword,
    PartnerCreate,
    PartnerVerificationStatus,
)
from app.schemas.role import UserRole
from app.schemas.token import Token
from app.services.google_sheets_service import google_sheets_service


class PartnerService:
    async def apply_partner(self, partner_in: PartnerCreate) -> User:
        """Submit delivery partner application with mandatory RS 1 application fee and 7-day reapplication cooldown check."""
        if partner_in.application_fee < 1.0:
            raise BadRequestException("Partner application fee of RS 1 is mandatory for registration.")

        cooldown_user = await user_crud.check_partner_cooldown(
            email=partner_in.email, phone=partner_in.phone
        )

        if cooldown_user:
            raise BadRequestException(
                "You have submitted an application within the last 7 days. Please wait 1 week before reapplying."
            )

        partner = await user_crud.create_partner_application(obj_in=partner_in)

        # Sync application details & documents to Google Sheet
        try:
            await google_sheets_service.sync_new_partner_application(partner)
        except Exception as e:
            pass

        return partner

    async def verify_partner(
        self, partner_user_id: str, status: PartnerVerificationStatus, rejection_reason: Optional[str] = None
    ) -> dict:
        """Admin verification endpoint: Approves or rejects partner application."""
        partner = await user_crud.get_by_id(user_id=partner_user_id)
        if not partner or partner.role != UserRole.PARTNER:
            raise NotFoundException("Delivery partner application not found.")

        if status == PartnerVerificationStatus.APPROVED:
            updated_partner, partner_id, initial_password = await user_crud.approve_partner(db_obj=partner)
            result = {
                "partner": updated_partner,
                "partner_id": partner_id,
                "initial_password": initial_password,
                "message": f"Partner approved successfully! Assigned Partner ID: {partner_id}",
            }
        else:
            updated_partner = await user_crud.reject_partner(
                db_obj=partner, reason=rejection_reason
            )
            result = {
                "partner": updated_partner,
                "partner_id": None,
                "initial_password": None,
                "message": "You are rejected. Try again later after 7 days.",
            }

        # Sync verification status update to Google Sheet
        try:
            await google_sheets_service.sync_partner_status_update(updated_partner)
        except Exception as e:
            pass

        return result

    async def patch_partner_by_admin(
        self, partner_user_id: str, obj_in: AdminPartnerUpdate
    ) -> User:
        """Patch partner details by Admin and sync changes to Google Sheet."""
        partner = await user_crud.get_by_id(user_id=partner_user_id)
        if not partner or partner.role != UserRole.PARTNER:
            raise NotFoundException("Delivery partner application not found.")

        updated_partner = await user_crud.update_partner_by_admin(db_obj=partner, obj_in=obj_in)

        # Sync updated fields to Google Sheet
        try:
            await google_sheets_service.sync_partner_status_update(updated_partner)
        except Exception as e:
            pass

        return updated_partner


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

        # Automatically turn partner online post-login
        if partner.partner_profile:
            partner.partner_profile.is_online = True
            partner.touch()
            await partner.save()

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
