from typing import Any, List, Optional
from fastapi import APIRouter, Depends
from app.api.deps import get_current_admin
from app.crud import user_crud
from app.models.user import User
from app.core.exceptions import NotFoundException
from app.schemas.partner import (
    AdminPartnerUpdate,
    PartnerVerificationStatus,
    PartnerVerificationUpdate,
)
from app.schemas.response import APIResponse
from app.schemas.role import UserRole
from app.schemas.user import UserResponse
from app.services.partner_service import partner_service

router = APIRouter()


@router.get("/users", response_model=APIResponse[List[UserResponse]])
async def list_all_users(
    role: Optional[UserRole] = None,
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(get_current_admin),
) -> Any:
    """List registered users filtered by role (Admin required)."""
    users = await user_crud.get_multi(role=role, skip=skip, limit=limit)
    return APIResponse(
        success=True,
        message="Users list retrieved successfully",
        data=[UserResponse.model_validate(u) for u in users],
    )


@router.get("/partners", response_model=APIResponse[List[UserResponse]])
async def list_partners(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(get_current_admin),
) -> Any:
    """
    List delivery partners filtered by verification status (pending, approved, rejected, all).
    Includes complete profile and document URLs (Aadhaar, PAN, Selfie).
    """
    if status and status.lower() != "all":
        try:
            ver_status = PartnerVerificationStatus(status.lower())
            partners = await user_crud.get_partners_by_verification_status(
                status=ver_status, skip=skip, limit=limit
            )
        except ValueError:
            partners = await user_crud.get_multi(role=UserRole.PARTNER, skip=skip, limit=limit)
    else:
        partners = await user_crud.get_multi(role=UserRole.PARTNER, skip=skip, limit=limit)

    return APIResponse(
        success=True,
        message="Partners list retrieved successfully",
        data=[UserResponse.model_validate(p) for p in partners],
    )


@router.get("/partners/pending", response_model=APIResponse[List[UserResponse]])
async def list_pending_partners(
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(get_current_admin),
) -> Any:
    """List delivery partners awaiting verification (Admin required)."""
    partners = await user_crud.get_partners_by_verification_status(
        status=PartnerVerificationStatus.PENDING, skip=skip, limit=limit
    )
    return APIResponse(
        success=True,
        message="Pending partners list retrieved successfully",
        data=[UserResponse.model_validate(p) for p in partners],
    )


@router.get("/partners/{partner_id}", response_model=APIResponse[UserResponse])
async def get_partner_details(
    partner_id: str,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Fetch complete details of a specific delivery partner (Admin required)."""
    partner = await user_crud.get_by_id(user_id=partner_id)
    if not partner or partner.role != UserRole.PARTNER:
        raise NotFoundException("Delivery partner application not found.")

    return APIResponse(
        success=True,
        message="Partner application details retrieved successfully",
        data=UserResponse.model_validate(partner),
    )


@router.patch("/partners/{partner_id}", response_model=APIResponse[UserResponse])
async def patch_partner_details(
    partner_id: str,
    req: AdminPartnerUpdate,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Patch/update any fields on partner profile (Admin required). Syncs updates to Google Sheets."""
    updated_partner = await partner_service.patch_partner_by_admin(
        partner_user_id=partner_id, obj_in=req
    )
    return APIResponse(
        success=True,
        message="Partner profile updated successfully by Admin.",
        data=UserResponse.model_validate(updated_partner),
    )


@router.patch("/partners/{partner_id}/verify", response_model=APIResponse[dict])
async def verify_partner_account(
    partner_id: str,
    req: PartnerVerificationUpdate,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Approve or reject a delivery partner application (Admin required). Generates Partner ID & Password on approval."""
    res = await partner_service.verify_partner(
        partner_user_id=partner_id,
        status=req.status,
        rejection_reason=req.rejection_reason,
    )
    partner_resp = UserResponse.model_validate(res["partner"])
    return APIResponse(
        success=True,
        message=res["message"],
        data={
            "partner": partner_resp.model_dump(),
            "partner_id": res["partner_id"],
            "initial_password": res["initial_password"],
        },
    )

