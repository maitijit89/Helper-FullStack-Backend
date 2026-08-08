from pathlib import Path
import secrets
from typing import Any
from fastapi import APIRouter, Depends, File, UploadFile, status

from app.api.deps import get_current_active_user
from app.core.exceptions import BadRequestException
from app.crud.crud_order import order_crud
from app.models.user import User
from app.schemas.assignment_service import (
    AssignmentCalculateRequest,
    AssignmentOrderConfirmRequest,
    AssignmentOrderCreate,
)
from app.schemas.order import OrderResponse
from app.schemas.response import APIResponse
from app.services.assignment_service import assignment_writer_engine
from app.services.page_counter_service import page_counter_engine

router = APIRouter()


@router.post(
    "/upload-reference",
    response_model=APIResponse[dict],
    status_code=status.HTTP_201_CREATED,
)
async def upload_assignment_reference(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Upload reference document or question paper images for Handwritten Assignment service.
    Automated Page Counter Engine parses reference document to suggest page count.
    """
    if not file.filename:
        raise BadRequestException("No file selected for upload.")

    upload_dir = Path("uploads/assignment_references")
    upload_dir.mkdir(parents=True, exist_ok=True)

    rand_id = secrets.token_hex(4)
    filename = f"{rand_id}_{file.filename.replace(' ', '_')}"
    file_path = upload_dir / filename

    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        file_size = len(content)
    except Exception as e:
        raise BadRequestException(f"Failed to save reference file: {str(e)}")

    detected_pages, method = page_counter_engine.count_pages(str(file_path), file.filename)
    cost = assignment_writer_engine.calculate_assignment_cost(
        num_pages=detected_pages,
        paper_type="a4_ruled",
        binding_type="none",
        ink_color="blue",
    )

    file_url = f"/static/assignment_references/{filename}"

    return APIResponse(
        success=True,
        message=f"Reference document uploaded! Engine detected {detected_pages} page(s).",
        data={
            "file_url": file_url,
            "document_name": file.filename,
            "detected_page_count": detected_pages,
            "detection_method": method,
            "file_size_bytes": file_size,
            "cost_breakdown": cost,
        },
    )


@router.post("/calculate-price", response_model=APIResponse[dict])
async def calculate_assignment_price(
    req: AssignmentCalculateRequest,
) -> Any:
    """
    Calculate and preview instant pricing breakdown for handwritten assignment writer orders.
    Calculates cost based on page count, paper type (A4 Ruled/Unruled, Practical Sheet), 
    and binding belongings (Channel File, Spiral File, None).
    """
    cost = assignment_writer_engine.calculate_assignment_cost(
        num_pages=req.num_pages,
        paper_type=req.paper_type,
        binding_type=req.binding_type,
        ink_color=req.ink_color,
    )
    return APIResponse(
        success=True,
        message=f"Assignment cost calculated for {req.num_pages} page(s).",
        data=cost,
    )


@router.post(
    "/confirm-order",
    response_model=APIResponse[OrderResponse],
    status_code=status.HTTP_201_CREATED,
)
async def confirm_assignment_order(
    req: AssignmentOrderConfirmRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Confirm and place Handwritten Assignment Writer order.
    Enforces minimum order price, payment method selection, and alerts delivery/writing partners within 1KM radius.
    """
    phone = req.customer_phone or current_user.phone or "N/A"

    order_in = AssignmentOrderCreate(
        file_url=req.file_url,
        document_name=req.document_name,
        is_physical_pickup=req.is_physical_pickup,
        num_pages=req.num_pages,
        paper_type=req.paper_type,
        binding_type=req.binding_type,
        ink_color=req.ink_color,
        delivery_address=req.delivery_address,
        delivery_location=req.delivery_location,
        customer_phone=phone,
        special_instructions=req.special_instructions,
        payment_method=req.payment_method,
        upi_transaction_id=req.upi_transaction_id,
    )

    order = await order_crud.create_assignment_order(
        customer_id=str(current_user.id), obj_in=order_in
    )

    return APIResponse(
        success=True,
        message="Handwritten assignment writer order placed successfully! Partners within 1 KM radius are being alerted.",
        data=OrderResponse.model_validate(order),
    )
