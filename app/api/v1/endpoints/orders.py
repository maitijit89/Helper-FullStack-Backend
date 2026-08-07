from typing import Any, List
from fastapi import APIRouter, Depends, status
from app.api.deps import get_current_active_user, get_current_partner_with_gps
from app.core.exceptions import NotFoundException
from app.crud.crud_order import order_crud
from app.models.user import User
from app.schemas.order import (
    OrderResponse,
    OrderStatusUpdate,
    PorterOrderCreate,
    PrintOrderCreate,
    QuickCommerceOrderCreate,
)
from app.schemas.response import APIResponse

router = APIRouter()


@router.post("/quick-commerce", response_model=APIResponse[OrderResponse], status_code=status.HTTP_201_CREATED)
async def create_quick_commerce_order(
    req: QuickCommerceOrderCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Place order for Snacks, Cold Drinks, Cakes & Stationery items."""
    order = await order_crud.create_quick_commerce_order(
        customer_id=str(current_user.id), obj_in=req
    )
    return APIResponse(
        success=True,
        message="Quick Commerce order placed successfully",
        data=OrderResponse.model_validate(order),
    )


@router.post("/print-service", response_model=APIResponse[OrderResponse], status_code=status.HTTP_201_CREATED)
async def create_print_service_order(
    req: PrintOrderCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Place order for Xerox, Document Printing, Spiral & Channel File Binding."""
    order = await order_crud.create_print_order(
        customer_id=str(current_user.id), obj_in=req
    )
    return APIResponse(
        success=True,
        message="Print/Xerox service order placed successfully",
        data=OrderResponse.model_validate(order),
    )


@router.post("/porter-service", response_model=APIResponse[OrderResponse], status_code=status.HTTP_201_CREATED)
async def create_porter_service_order(
    req: PorterOrderCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Request Porter Parcel Courier Service for items under 5 kg."""
    order = await order_crud.create_porter_order(
        customer_id=str(current_user.id), obj_in=req
    )
    return APIResponse(
        success=True,
        message="Porter delivery service request placed successfully (< 5kg)",
        data=OrderResponse.model_validate(order),
    )


@router.get("/me", response_model=APIResponse[List[OrderResponse]])
async def get_my_orders(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get active and past orders placed by current user."""
    orders = await order_crud.get_user_orders(
        customer_id=str(current_user.id), skip=skip, limit=limit
    )
    return APIResponse(
        success=True,
        message="User orders fetched successfully",
        data=[OrderResponse.model_validate(o) for o in orders],
    )


@router.get("/available", response_model=APIResponse[List[OrderResponse]])
async def get_available_partner_orders(
    skip: int = 0,
    limit: int = 100,
    current_partner: User = Depends(get_current_partner_with_gps),
) -> Any:
    """List available orders for delivery partners (requires device GPS ON)."""
    orders = await order_crud.get_available_partner_orders(skip=skip, limit=limit)
    return APIResponse(
        success=True,
        message="Available orders fetched for delivery partner",
        data=[OrderResponse.model_validate(o) for o in orders],
    )


@router.patch("/{order_id}/accept", response_model=APIResponse[OrderResponse])
async def accept_order(
    order_id: str,
    current_partner: User = Depends(get_current_partner_with_gps),
) -> Any:
    """Delivery partner accepts order (requires device GPS ON)."""
    order = await order_crud.accept_order_partner(
        order_id=order_id, partner_id=str(current_partner.id)
    )
    return APIResponse(
        success=True,
        message="Order accepted successfully by partner",
        data=OrderResponse.model_validate(order),
    )


@router.patch("/{order_id}/status", response_model=APIResponse[OrderResponse])
async def update_order_status(
    order_id: str,
    status_in: OrderStatusUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update order status (out_for_delivery, delivered, cancelled)."""
    order = await order_crud.update_order_status(
        order_id=order_id, status=status_in.status
    )
    return APIResponse(
        success=True,
        message=f"Order status updated to {status_in.status.value}",
        data=OrderResponse.model_validate(order),
    )


@router.get("/{order_id}", response_model=APIResponse[OrderResponse])
async def get_order_by_id(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Get single order details by ID."""
    order = await order_crud.get_by_id(order_id)
    if not order:
        raise NotFoundException("Order not found")
    return APIResponse(
        success=True,
        message="Order details fetched",
        data=OrderResponse.model_validate(order),
    )
