import os
from typing import Any, List
from fastapi import APIRouter, Depends, status
from app.api.deps import get_current_active_user, get_current_partner_with_gps
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException


from app.crud.crud_order import order_crud
from app.models.order import OrderStatus, OrderType
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



from app.services.analytics_service import FeatureCategory, analytics_service


@router.post("/quick-commerce", response_model=APIResponse[OrderResponse], status_code=status.HTTP_201_CREATED)
async def create_quick_commerce_order(
    req: QuickCommerceOrderCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Place order for Snacks, Cold Drinks, Cakes & Stationery items."""
    order = await order_crud.create_quick_commerce_order(
        customer_id=str(current_user.id), obj_in=req
    )
    analytics_service.record_feature_usage(FeatureCategory.PRODUCT_ORDER, str(current_user.id))
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
    analytics_service.record_feature_usage(FeatureCategory.PRINT_SERVICE, str(current_user.id))
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
    analytics_service.record_feature_usage(FeatureCategory.PORTER_DELIVERY, str(current_user.id))
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


@router.patch("/{order_id}/pickup-document", response_model=APIResponse[OrderResponse])
async def confirm_physical_document_pickup(
    order_id: str,
    current_partner: User = Depends(get_current_partner_with_gps),
) -> Any:
    """
    Delivery partner confirms physical hardcopy document pickup from customer for Xerox.
    Updates order status to DOCUMENT_PICKED_UP.
    """
    order = await order_crud.get_by_id(order_id)
    if not order:
        raise NotFoundException("Order not found")

    if str(current_partner.id) != order.partner_id:
        raise ForbiddenException("You are not the assigned delivery partner for this order.")

    if order.order_type != OrderType.PRINT_SERVICE:
        raise BadRequestException("This order is not a Xerox/Print Service order.")

    updated_order = await order_crud.update_order_status(
        order_id=order_id, status=OrderStatus.DOCUMENT_PICKED_UP
    )

    return APIResponse(
        success=True,
        message="Physical hardcopy document picked up from customer successfully! Order status set to DOCUMENT_PICKED_UP.",
        data=OrderResponse.model_validate(updated_order),
    )


@router.patch("/{order_id}/status", response_model=APIResponse[OrderResponse])
async def update_order_status(
    order_id: str,
    status_in: OrderStatusUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update order status (document_picked_up, out_for_delivery, delivered, cancelled)."""
    order = await order_crud.update_order_status(
        order_id=order_id, status=status_in.status
    )
    return APIResponse(
        success=True,
        message=f"Order status updated to {status_in.status.value}",
        data=OrderResponse.model_validate(order),
    )



@router.get("/{order_id}/live-location", response_model=APIResponse[dict])
async def get_order_live_location(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Fetch real-time live location of both Delivery Partner and Customer for active order.
    Allowed for assigned Customer, assigned Delivery Partner, or Admin.
    """
    from app.crud.crud_user import user_crud
    from app.services.geo_service import calculate_haversine_distance

    order = await order_crud.get_by_id(order_id)
    if not order:
        raise NotFoundException("Order not found")

    user_id_str = str(current_user.id)
    if (
        order.customer_id != user_id_str
        and order.partner_id != user_id_str
        and not current_user.is_superuser
    ):
        raise ForbiddenException("You are not authorized to view live tracking for this order.")

    partner_loc = None
    partner_info = None
    if order.partner_id:
        partner_user = await user_crud.get_by_id(order.partner_id)
        if partner_user and partner_user.location:
            partner_loc = partner_user.location.model_dump()
            partner_info = {
                "id": str(partner_user.id),
                "name": partner_user.full_name or "Delivery Partner",
                "phone": partner_user.phone,
            }

    customer_loc = order.delivery_location.model_dump() if order.delivery_location else None
    if not customer_loc:
        customer_user = await user_crud.get_by_id(order.customer_id)
        if customer_user and customer_user.location:
            customer_loc = customer_user.location.model_dump()

    dist_km = None
    if partner_loc and customer_loc:
        dist_km = calculate_haversine_distance(
            partner_loc["latitude"],
            partner_loc["longitude"],
            customer_loc["latitude"],
            customer_loc["longitude"],
        )

    return APIResponse(
        success=True,
        message="Live location fetched successfully",
        data={
            "order_id": order.order_id,
            "status": order.status.value,
            "partner": partner_info,
            "partner_location": partner_loc,
            "customer_location": customer_loc,
            "distance_between_km": dist_km,
        },
    )


from fastapi.responses import FileResponse, JSONResponse
from app.models.order import OrderType


@router.get("/{order_id}/document", response_model=APIResponse[dict])
async def get_print_order_document_details(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Fetch document specifications, page count, color mode, paper size, binding, and download link for Print/Xerox order.
    Allowed for assigned Delivery Partner, Customer, or Admin after order acceptance.
    """
    order = await order_crud.get_by_id(order_id)
    if not order:
        raise NotFoundException("Order not found")

    if order.order_type != OrderType.PRINT_SERVICE or not order.print_spec:
        raise BadRequestException("This order is not a Print/Xerox service order.")

    user_id_str = str(current_user.id)
    if (
        order.partner_id != user_id_str
        and order.customer_id != user_id_str
        and not current_user.is_superuser
    ):
        raise ForbiddenException("You are not authorized to view the print document for this order.")

    spec = order.print_spec
    download_url = f"/api/v1/orders/{order.order_id}/download-document"

    return APIResponse(
        success=True,
        message="Print document details fetched successfully.",
        data={
            "order_id": order.order_id,
            "order_status": order.status.value,
            "document_name": spec.document_name,
            "file_url": spec.file_url,
            "download_url": download_url,
            "num_pages": spec.num_pages,
            "num_copies": spec.num_copies,
            "color_mode": spec.color_mode,
            "paper_size": spec.paper_size,
            "is_double_sided": spec.is_double_sided,
            "binding_type": spec.binding_type,
            "special_instructions": spec.special_instructions,
        },
    )


@router.get("/{order_id}/download-document")
async def download_print_order_document(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Download/Stream the uploaded document file for printing.
    Allowed exclusively for assigned Delivery Partner, Customer, or Admin.
    """
    order = await order_crud.get_by_id(order_id)
    if not order:
        raise NotFoundException("Order not found")

    if order.order_type != OrderType.PRINT_SERVICE or not order.print_spec:
        raise BadRequestException("This order is not a Print/Xerox service order.")

    user_id_str = str(current_user.id)
    if (
        order.partner_id != user_id_str
        and order.customer_id != user_id_str
        and not current_user.is_superuser
    ):
        raise ForbiddenException("You are not authorized to download the print document for this order.")

    file_url = order.print_spec.file_url
    if not file_url:
        raise NotFoundException("No document file associated with this print order.")

    # Resolve local file path from /static/print_documents/filename
    clean_path = file_url.replace("/static/", "uploads/")
    if not os.path.exists(clean_path):
        raise NotFoundException("Document file not found on server storage.")

    filename = order.print_spec.document_name or os.path.basename(clean_path)
    return FileResponse(
        path=clean_path,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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


