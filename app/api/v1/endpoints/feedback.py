from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query, status
from app.api.deps import get_current_active_user, get_current_admin
from app.core.exceptions import ForbiddenException, NotFoundException
from app.crud.crud_feedback import feedback_crud
from app.models.feedback import FeedbackCategory, FeedbackStatus
from app.models.user import User
from app.schemas.feedback import (
    FeedbackAdminPatch,
    FeedbackAnalyticsSummary,
    FeedbackCreate,
    FeedbackResponse,
)
from app.schemas.response import APIResponse
from app.schemas.role import UserRole

router = APIRouter()


# ===========================================================================
# User & Partner Feedback Endpoints
# ===========================================================================


@router.post("/", response_model=APIResponse[FeedbackResponse], status_code=status.HTTP_201_CREATED)
async def submit_app_feedback(
    req: FeedbackCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Submit app feedback, rating, suggestions, or bug reports (Customers & Delivery Partners).
    Captures role, category, star rating (1-5), message, and optional device telemetry.
    """
    feedback_doc = await feedback_crud.create_feedback(user=current_user, obj_in=req)
    return APIResponse(
        success=True,
        message="App feedback submitted successfully. Thank you for helping us improve Helper!",
        data=FeedbackResponse.model_validate(feedback_doc),
    )


@router.get("/me", response_model=APIResponse[List[FeedbackResponse]])
async def get_my_feedbacks(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """List all app feedback submissions and admin responses for the current user/partner."""
    feedbacks = await feedback_crud.get_user_feedback(
        user_id=str(current_user.id), skip=skip, limit=limit
    )
    return APIResponse(
        success=True,
        message="My feedback submissions retrieved successfully.",
        data=[FeedbackResponse.model_validate(f) for f in feedbacks],
    )


@router.get("/{feedback_id}", response_model=APIResponse[FeedbackResponse])
async def get_feedback_by_id(
    feedback_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """View details of a specific feedback submission."""
    doc = await feedback_crud.get_by_id(feedback_id=feedback_id)
    if not doc:
        raise NotFoundException("Feedback entry not found.")

    # Only author or admin can view
    if doc.user_id != str(current_user.id) and not current_user.is_superuser:
        raise ForbiddenException("You are not authorized to view this feedback entry.")

    return APIResponse(
        success=True,
        message="Feedback details fetched successfully.",
        data=FeedbackResponse.model_validate(doc),
    )


# ===========================================================================
# Admin Feedback Management & Dashboard Endpoints
# ===========================================================================


@router.get("/admin/all", response_model=APIResponse[List[FeedbackResponse]])
async def list_all_feedbacks_admin(
    role: Optional[UserRole] = Query(None, description="Filter by user role e.g. user, partner"),
    category: Optional[FeedbackCategory] = Query(None, description="Filter by category"),
    status: Optional[FeedbackStatus] = Query(None, description="Filter by status e.g. new, in_review, resolved"),
    min_rating: Optional[float] = Query(None, ge=1.0, le=5.0, description="Minimum star rating filter"),
    max_rating: Optional[float] = Query(None, ge=1.0, le=5.0, description="Maximum star rating filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    admin: User = Depends(get_current_admin),
) -> Any:
    """Fetch all app feedback across the platform with rich multi-parameter filtering (Admin required)."""
    feedbacks = await feedback_crud.get_all_feedback(
        role=role,
        category=category,
        status=status,
        min_rating=min_rating,
        max_rating=max_rating,
        skip=skip,
        limit=limit,
    )
    return APIResponse(
        success=True,
        message="App feedbacks retrieved successfully for Admin.",
        data=[FeedbackResponse.model_validate(f) for f in feedbacks],
    )


@router.get("/admin/summary", response_model=APIResponse[FeedbackAnalyticsSummary])
async def get_feedback_analytics_summary(
    admin: User = Depends(get_current_admin),
) -> Any:
    """Fetch real-time app satisfaction analytics and category/status breakdown for Admin Dashboard."""
    summary = await feedback_crud.get_feedback_analytics()
    return APIResponse(
        success=True,
        message="Feedback analytics summary fetched successfully.",
        data=summary,
    )


@router.patch("/admin/{feedback_id}", response_model=APIResponse[FeedbackResponse])
async def triage_feedback_admin(
    feedback_id: str,
    req: FeedbackAdminPatch,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Update feedback status, add internal notes, and write official response (Admin required)."""
    updated_doc = await feedback_crud.admin_patch_feedback(feedback_id=feedback_id, obj_in=req)
    return APIResponse(
        success=True,
        message=f"Feedback status updated to '{updated_doc.status.value}'.",
        data=FeedbackResponse.model_validate(updated_doc),
    )


@router.delete("/admin/{feedback_id}", response_model=APIResponse[dict])
async def delete_feedback_admin(
    feedback_id: str,
    admin: User = Depends(get_current_admin),
) -> Any:
    """Delete a feedback entry permanently (Admin required)."""
    await feedback_crud.delete_feedback(feedback_id=feedback_id)
    return APIResponse(
        success=True,
        message="Feedback entry deleted successfully.",
        data={"feedback_id": feedback_id, "deleted": True},
    )
