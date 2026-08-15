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
from app.schemas.rating import AdminPartnerRatingOverride, AdminRatingPatch
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


# ---------------------------------------------------------------------------
# Admin Rating & Review Moderation Endpoints
# ---------------------------------------------------------------------------


@router.get("/ratings", response_model=APIResponse[List[Any]])
async def list_all_ratings(
    partner_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    min_rating: Optional[float] = None,
    max_rating: Optional[float] = None,
    is_hidden: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(get_current_admin),
) -> Any:
    """List all ratings platform-wide with filtering for moderation (Admin required)."""
    from app.crud.crud_rating import rating_crud
    from app.schemas.rating import RatingResponse

    ratings = await rating_crud.list_all_ratings(
        partner_id=partner_id,
        customer_id=customer_id,
        min_rating=min_rating,
        max_rating=max_rating,
        is_hidden=is_hidden,
        skip=skip,
        limit=limit,
    )
    return APIResponse(
        success=True,
        message="Ratings retrieved successfully",
        data=[RatingResponse.model_validate(r) for r in ratings],
    )


@router.get("/ratings/{rating_id}", response_model=APIResponse[Any])
async def get_rating_by_id(
    rating_id: str,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Get single rating details including admin moderation notes (Admin required)."""
    from app.crud.crud_rating import rating_crud
    from app.schemas.rating import RatingResponse

    rating_doc = await rating_crud.get_by_id(rating_id=rating_id)
    if not rating_doc:
        raise NotFoundException("Rating not found.")

    return APIResponse(
        success=True,
        message="Rating details fetched successfully",
        data=RatingResponse.model_validate(rating_doc),
    )


@router.patch("/ratings/{rating_id}", response_model=APIResponse[Any])
async def patch_rating_moderation(
    rating_id: str,
    admin_patch: AdminRatingPatch,
    admin: User = Depends(get_current_admin),
) -> Any:
    """
    Moderate / patch a rating: edit score, text, tags, hide/unhide review, or add admin notes.
    Automatically recalculates partner aggregate rating score.
    """
    from app.crud.crud_rating import rating_crud
    from app.schemas.rating import RatingResponse

    updated = await rating_crud.admin_patch_rating(rating_id=rating_id, obj_in=admin_patch)
    return APIResponse(
        success=True,
        message="Rating moderated successfully",
        data=RatingResponse.model_validate(updated),
    )


@router.delete("/ratings/{rating_id}", response_model=APIResponse[dict])
async def delete_rating(
    rating_id: str,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Delete a spam or abusive rating permanently (Admin required). Recalculates partner rating."""
    from app.crud.crud_rating import rating_crud

    await rating_crud.admin_delete_rating(rating_id=rating_id)
    return APIResponse(
        success=True,
        message="Rating deleted successfully and partner metrics updated.",
        data={"rating_id": rating_id, "deleted": True},
    )


@router.patch("/partners/{partner_id}/rating", response_model=APIResponse[UserResponse])
async def override_partner_rating(
    partner_id: str,
    override_in: AdminPartnerRatingOverride,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Directly override partner aggregate rating and count (Admin required)."""
    from app.crud.crud_rating import rating_crud

    partner = await rating_crud.admin_override_partner_rating(partner_id=partner_id, obj_in=override_in)
    return APIResponse(
        success=True,
        message="Partner rating overridden successfully",
        data=UserResponse.model_validate(partner),
    )


@router.post("/partners/{partner_id}/recalculate-rating", response_model=APIResponse[UserResponse])
async def recalculate_partner_rating(
    partner_id: str,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Recalculate partner aggregate rating from all active, visible reviews (Admin required)."""
    from app.crud.crud_rating import rating_crud

    partner = await rating_crud.recalculate_partner_rating(partner_id=partner_id)
    if not partner:
        raise NotFoundException("Partner not found.")
    return APIResponse(
        success=True,
        message="Partner rating recalculated successfully from database records",
        data=UserResponse.model_validate(partner),
    )


# ---------------------------------------------------------------------------
# Admin User Moderation Endpoints
# ---------------------------------------------------------------------------


@router.patch("/users/{user_id}/status", response_model=APIResponse[UserResponse])
async def update_user_status(
    user_id: str,
    is_active: bool,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Activate or suspend/block a user or partner account (Admin required)."""
    user = await user_crud.get_by_id(user_id=user_id)
    if not user:
        raise NotFoundException("User not found.")

    user.is_active = is_active
    user.touch()
    await user.save()

    status_str = "activated" if is_active else "suspended / deactivated"
    return APIResponse(
        success=True,
        message=f"User account '{user.email}' has been {status_str}.",
        data=UserResponse.model_validate(user),
    )


@router.patch("/users/{user_id}/role", response_model=APIResponse[UserResponse])
async def update_user_role(
    user_id: str,
    role: UserRole,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Update user role (user, partner, admin) (Admin required)."""
    user = await user_crud.get_by_id(user_id=user_id)
    if not user:
        raise NotFoundException("User not found.")

    user.role = role
    if role == UserRole.ADMIN:
        user.is_superuser = True
    user.touch()
    await user.save()

    return APIResponse(
        success=True,
        message=f"User role updated to '{role.value}'.",
        data=UserResponse.model_validate(user),
    )


@router.delete("/users/{user_id}", response_model=APIResponse[dict])
async def delete_user_by_admin(
    user_id: str,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Permanently delete a user account from MongoDB (Admin required)."""
    user = await user_crud.get_by_id(user_id=user_id)
    if not user:
        raise NotFoundException("User not found.")

    email = user.email
    await user_crud.delete_user(db_obj=user)
    return APIResponse(
        success=True,
        message=f"User '{email}' deleted permanently.",
        data={"user_id": user_id, "deleted": True},
    )


# ---------------------------------------------------------------------------
# Admin Order Management Endpoints
# ---------------------------------------------------------------------------


@router.get("/orders", response_model=APIResponse[List[Any]])
async def list_all_orders_admin(
    status: Optional[str] = None,
    order_type: Optional[str] = None,
    payment_status: Optional[str] = None,
    customer_id: Optional[str] = None,
    partner_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(get_current_admin),
) -> Any:
    """List all orders platform-wide with multi-field filters (Admin required)."""
    from app.crud.crud_order import order_crud
    from app.models.order import OrderStatus, OrderType, PaymentStatus
    from app.schemas.order import OrderResponse

    st_enum = OrderStatus(status) if status else None
    ot_enum = OrderType(order_type) if order_type else None
    ps_enum = PaymentStatus(payment_status) if payment_status else None

    orders = await order_crud.get_all_orders(
        status=st_enum,
        order_type=ot_enum,
        payment_status=ps_enum,
        customer_id=customer_id,
        partner_id=partner_id,
        skip=skip,
        limit=limit,
    )
    return APIResponse(
        success=True,
        message="Orders list retrieved successfully for Admin.",
        data=[OrderResponse.model_validate(o) for o in orders],
    )


@router.get("/orders/{order_id}", response_model=APIResponse[Any])
async def get_order_details_admin(
    order_id: str,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Fetch complete details of any order by ID (Admin required)."""
    from app.crud.crud_order import order_crud
    from app.schemas.order import OrderResponse

    order = await order_crud.get_by_id(order_id)
    if not order:
        raise NotFoundException("Order not found.")

    return APIResponse(
        success=True,
        message="Order details retrieved successfully.",
        data=OrderResponse.model_validate(order),
    )


@router.post("/orders/{order_id}/assign-partner", response_model=APIResponse[Any])
async def force_assign_partner_admin(
    order_id: str,
    partner_id: str,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Force-assign or reassign an order to a delivery partner (Admin required)."""
    from app.crud.crud_order import order_crud
    from app.schemas.order import OrderResponse

    order = await order_crud.force_assign_partner(order_id=order_id, partner_id=partner_id)
    return APIResponse(
        success=True,
        message=f"Order '{order_id}' assigned to delivery partner successfully.",
        data=OrderResponse.model_validate(order),
    )


@router.post("/orders/{order_id}/cancel", response_model=APIResponse[Any])
async def cancel_order_admin(
    order_id: str,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Admin cancels an order and triggers refund if prepaid (Admin required)."""
    from app.crud.crud_order import order_crud
    from app.models.order import OrderStatus
    from app.schemas.order import OrderResponse

    order = await order_crud.update_order_status(order_id=order_id, status=OrderStatus.CANCELLED)
    return APIResponse(
        success=True,
        message=f"Order '{order_id}' has been cancelled by Admin. Any online payment has been refunded.",
        data=OrderResponse.model_validate(order),
    )



