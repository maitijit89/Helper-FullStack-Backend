from typing import Any, List
from fastapi import APIRouter, Depends, status
from app.api.deps import (
    get_current_active_user,
    get_current_admin,
)
from app.crud import user_crud
from app.models.user import User
from app.schemas.location import LocationUpdate
from app.schemas.response import APIResponse
from app.schemas.user import UserResponse, UserUpdate

router = APIRouter()


@router.get("/me", response_model=APIResponse[UserResponse])
async def read_user_me(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get profile of current authenticated user."""
    return APIResponse(
        success=True,
        message="User profile fetched",
        data=UserResponse.model_validate(current_user),
    )


@router.put("/me", response_model=APIResponse[UserResponse])
async def update_user_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update profile of current authenticated user."""
    updated_user = await user_crud.update_user(db_obj=current_user, obj_in=user_in)
    return APIResponse(
        success=True,
        message="User profile updated successfully",
        data=UserResponse.model_validate(updated_user),
    )


@router.put("/me/location", response_model=APIResponse[UserResponse])
async def update_user_location(
    location_in: LocationUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update GPS location and device location status for current user."""
    updated_user = await user_crud.update_user_location(
        db_obj=current_user, location_in=location_in
    )
    return APIResponse(
        success=True,
        message="GPS location updated successfully",
        data=UserResponse.model_validate(updated_user),
    )


@router.delete("/me", response_model=APIResponse[dict])
async def delete_user_me(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Delete current authenticated user account permanently."""
    await user_crud.delete_user(db_obj=current_user)
    return APIResponse(
        success=True,
        message="Account deleted successfully.",
        data={"email": current_user.email, "status": "deleted"},
    )


@router.get("/", response_model=APIResponse[List[UserResponse]])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin),
) -> Any:
    """Retrieve list of users (Admin required)."""
    users = await user_crud.get_multi(skip=skip, limit=limit)
    return APIResponse(
        success=True,
        message="Users list fetched",
        data=[UserResponse.model_validate(u) for u in users],
    )
