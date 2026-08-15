from typing import Any, List
from fastapi import APIRouter, Depends, status
from app.api.deps import get_current_active_user
from app.crud.crud_rating import rating_crud
from app.models.user import User
from app.schemas.rating import (
    PartnerRatingSummary,
    RatingCreate,
    RatingResponse,
    RatingUpdate,
)
from app.schemas.response import APIResponse

router = APIRouter()


@router.post("/", response_model=APIResponse[RatingResponse], status_code=status.HTTP_201_CREATED)
async def create_partner_rating(
    req: RatingCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Rate and review a delivery partner for a completed/delivered order.
    - Validates order ownership and delivered status.
    - Automatically updates Order model and recalculates Partner aggregate rating score.
    """
    rating_doc = await rating_crud.create_rating(customer=current_user, obj_in=req)
    return APIResponse(
        success=True,
        message="Partner rated successfully. Thank you for your feedback!",
        data=RatingResponse.model_validate(rating_doc),
    )


@router.get("/my-ratings", response_model=APIResponse[List[RatingResponse]])
async def get_my_ratings(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """List all ratings and reviews submitted by the current authenticated customer."""
    ratings = await rating_crud.get_my_ratings(
        customer_id=str(current_user.id), skip=skip, limit=limit
    )
    return APIResponse(
        success=True,
        message="My submitted ratings retrieved successfully",
        data=[RatingResponse.model_validate(r) for r in ratings],
    )


@router.get("/order/{order_id}", response_model=APIResponse[RatingResponse])
async def get_order_rating(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Fetch rating details for a specific order ID."""
    rating_doc = await rating_crud.get_by_order_id(order_id=order_id)
    if not rating_doc:
        return APIResponse(
            success=False,
            message="No rating found for this order.",
            data=None,
        )

    return APIResponse(
        success=True,
        message="Order rating retrieved successfully",
        data=RatingResponse.model_validate(rating_doc),
    )


@router.patch("/{rating_id}", response_model=APIResponse[RatingResponse])
async def patch_my_rating(
    rating_id: str,
    req: RatingUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Customer updates / patches their existing rating score, review comment, or feedback tags."""
    updated_rating = await rating_crud.update_customer_rating(
        rating_id=rating_id,
        customer_id=str(current_user.id),
        obj_in=req,
    )
    return APIResponse(
        success=True,
        message="Rating updated successfully",
        data=RatingResponse.model_validate(updated_rating),
    )


@router.get("/partner/{partner_id}", response_model=APIResponse[PartnerRatingSummary])
async def get_partner_rating_summary(
    partner_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Fetch overall rating metrics, star distribution, and recent visible reviews for a partner."""
    summary = await rating_crud.get_partner_rating_summary(partner_id=partner_id)
    return APIResponse(
        success=True,
        message="Partner ratings summary retrieved successfully",
        data=summary,
    )
