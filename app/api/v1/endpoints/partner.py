from typing import Any
from fastapi import APIRouter, Depends
from app.api.deps import get_current_active_user, get_current_partner
from app.core.exceptions import BadRequestException
from app.crud import user_crud
from app.models.user import User
from app.schemas.location import LocationUpdate
from app.schemas.partner import PartnerChangePassword, PartnerUpdate
from app.schemas.response import APIResponse
from app.schemas.user import UserResponse
from app.services.partner_service import partner_service

router = APIRouter()


@router.get("/me", response_model=APIResponse[UserResponse])
async def get_partner_me(
    current_partner: User = Depends(get_current_active_user),
) -> Any:
    """Get profile and vehicle status of current delivery partner."""
    return APIResponse(
        success=True,
        message="Partner profile fetched successfully",
        data=UserResponse.model_validate(current_partner),
    )


@router.put("/me", response_model=APIResponse[UserResponse])
async def update_partner_me(
    partner_in: PartnerUpdate,
    current_partner: User = Depends(get_current_partner),
) -> Any:
    """Update profile details for delivery partner."""
    updated_partner = await user_crud.update_partner_profile(
        db_obj=current_partner, obj_in=partner_in
    )
    return APIResponse(
        success=True,
        message="Partner profile updated successfully",
        data=UserResponse.model_validate(updated_partner),
    )


@router.put("/location", response_model=APIResponse[UserResponse])
async def update_partner_location(
    location_in: LocationUpdate,
    current_partner: User = Depends(get_current_partner),
) -> Any:
    """Update live GPS location coordinates for delivery partner."""
    updated_partner = await user_crud.update_user_location(
        db_obj=current_partner, location_in=location_in
    )

    # Push live location update to active orders assigned to partner
    from beanie.operators import In
    from app.models.order import Order, OrderStatus
    from app.services.websocket_manager import socket_manager

    active_orders = await Order.find(
        Order.partner_id == str(updated_partner.id),
        In(Order.status, [OrderStatus.ACCEPTED, OrderStatus.ASSIGNED, OrderStatus.OUT_FOR_DELIVERY]),
    ).to_list()


    for order in active_orders:
        await socket_manager.broadcast_order_live_location(
            order_id=order.order_id,
            sender_role="partner",
            sender_id=str(updated_partner.id),
            location_payload=location_in.model_dump(),
        )

    return APIResponse(
        success=True,
        message="Delivery partner GPS location updated successfully",
        data=UserResponse.model_validate(updated_partner),
    )



@router.put("/change-password", response_model=APIResponse[UserResponse])
async def change_partner_password(
    req: PartnerChangePassword,
    current_partner: User = Depends(get_current_partner),
) -> Any:
    """Change delivery partner password using previous password and new password."""
    updated_partner = await partner_service.change_password(
        user=current_partner, req=req
    )
    return APIResponse(
        success=True,
        message="Password changed successfully.",
        data=UserResponse.model_validate(updated_partner),
    )


@router.patch("/toggle-online", response_model=APIResponse[UserResponse])
async def toggle_online(
    is_online: bool,
    current_partner: User = Depends(get_current_partner),
) -> Any:
    """Toggle online / offline availability status for delivery requests (requires device GPS ON)."""
    if is_online and (not current_partner.is_gps_enabled or not current_partner.location):
        raise BadRequestException(
            "Device GPS must be enabled and active location provided to go online."
        )

    updated_partner = await user_crud.toggle_partner_online(
        db_obj=current_partner, is_online=is_online
    )
    status_str = "online" if is_online else "offline"
    return APIResponse(
        success=True,
        message=f"Partner is now {status_str}",
        data=UserResponse.model_validate(updated_partner),
    )


@router.get("/ringing-orders", response_model=APIResponse[list])
async def get_ringing_orders(
    current_partner: User = Depends(get_current_partner),
) -> Any:
    """Fetch active ringing order calls for open partner app within 1 KM radius."""
    from app.services.websocket_manager import socket_manager

    ringing = socket_manager.get_active_ringing_orders_for_partner(str(current_partner.id))
    return APIResponse(
        success=True,
        message="Active ringing orders fetched successfully",
        data=ringing,
    )

