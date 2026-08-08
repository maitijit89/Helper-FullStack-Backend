import os
from pathlib import Path
import secrets
from typing import Any
from fastapi import APIRouter, Depends, File, UploadFile, status
from app.api.deps import get_current_active_user
from app.core.exceptions import BadRequestException
from app.crud.crud_order import order_crud
from app.models.user import User
from app.schemas.order import OrderResponse, PrintOrderCreate
from app.schemas.print_service import (
    DocumentUploadResponse,
    PrintOptionsCalculateRequest,
    PrintOrderConfirmRequest,
    RecountRequest,
    RecountResponse,
)
from app.schemas.response import APIResponse
from app.services.page_counter_service import page_counter_engine

router = APIRouter()


@router.post("/upload-document", response_model=APIResponse[DocumentUploadResponse], status_code=status.HTTP_201_CREATED)
async def upload_print_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Upload document file (PDF, Docx, Text, Images) for Print/Xerox service.
    Automated Page Counter Engine parses the file and returns exact detected page count.
    """
    if not file.filename:
        raise BadRequestException("No file selected for upload.")

    # Create uploads/print_documents directory structure
    upload_dir = Path("uploads/print_documents")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Save uploaded file with safe unique filename
    rand_id = secrets.token_hex(4)
    filename = f"{rand_id}_{file.filename.replace(' ', '_')}"
    file_path = upload_dir / filename

    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        file_size = len(content)
    except Exception as e:
        raise BadRequestException(f"Failed to save uploaded file: {str(e)}")

    # Run Automated Page Counter Engine
    detected_pages, method = page_counter_engine.count_pages(str(file_path), file.filename)
    cost = page_counter_engine.calculate_print_cost(
        num_pages=detected_pages,
        num_copies=1,
        color_mode="black_and_white",
        paper_size="A4",
        is_double_sided=False,
        binding_type="none",
    )

    file_url = f"/static/print_documents/{filename}"

    return APIResponse(
        success=True,
        message=f"Document uploaded successfully! Page Counter Engine detected {detected_pages} page(s).",
        data=DocumentUploadResponse(
            file_url=file_url,
            document_name=file.filename,
            detected_page_count=detected_pages,
            detection_method=method,
            file_size_bytes=file_size,
            cost_breakdown=cost,
        ),
    )


@router.post("/recount", response_model=APIResponse[RecountResponse])
async def recount_pages(
    req: RecountRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Recount pages for uploaded document.
    Allows user to filter specific page ranges (e.g. '1-5, 8-12') or provide a manual page count override.
    """
    if req.manual_page_override is not None:
        final_pages = req.manual_page_override
        recount_type = "manual_override"
        msg = f"Page count manually updated to {final_pages} page(s)."
    elif req.page_range:
        final_pages = page_counter_engine.parse_page_range(req.page_range, req.total_detected_pages)
        recount_type = "range_filter"
        msg = f"Page range '{req.page_range}' evaluated to {final_pages} page(s)."
    else:
        final_pages = req.total_detected_pages
        recount_type = "all_pages"
        msg = f"All {final_pages} page(s) selected."

    cost = page_counter_engine.calculate_print_cost(
        num_pages=final_pages,
        num_copies=req.num_copies,
        color_mode=req.color_mode,
        paper_size=req.paper_size,
        is_double_sided=req.is_double_sided,
        binding_type=req.binding_type,
    )

    return APIResponse(
        success=True,
        message=msg,
        data=RecountResponse(
            file_url=req.file_url,
            document_name=req.document_name,
            recount_type=recount_type,
            final_page_count=final_pages,
            cost_breakdown=cost,
            message=msg,
        ),
    )


@router.post("/calculate-price", response_model=APIResponse[dict])
async def calculate_print_price(
    req: PrintOptionsCalculateRequest,
) -> Any:
    """
    Calculate and preview instant price breakdown for print options.
    Allows user to see costs when switching between Colour (RS 10/pg) and Black & White (RS 2/pg), 
    changing paper size (A4/A3), double-sided printing, copies, and binding types.
    """
    cost = page_counter_engine.calculate_print_cost(
        num_pages=req.num_pages,
        num_copies=req.num_copies,
        color_mode=req.color_mode,
        paper_size=req.paper_size,
        is_double_sided=req.is_double_sided,
        binding_type=req.binding_type,
    )
    return APIResponse(
        success=True,
        message=f"Print cost calculated for {req.color_mode} mode.",
        data=cost,
    )


@router.post("/confirm-order", response_model=APIResponse[OrderResponse], status_code=status.HTTP_201_CREATED)
async def confirm_print_order(
    req: PrintOrderConfirmRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    User confirms page count ('OK') and places Xerox / Document Print service order.
    Enforces RS. 10 minimum order price, payment method selection (UPI/Cash), and rings delivery partners within 1KM.
    """
    phone = req.customer_phone or current_user.phone or "N/A"

    order_in = PrintOrderCreate(
        file_url=req.file_url,
        document_name=req.document_name,
        is_physical_pickup=req.is_physical_pickup,
        num_pages=req.confirmed_num_pages,
        num_copies=req.num_copies,
        color_mode=req.color_mode,
        paper_size=req.paper_size,
        is_double_sided=req.is_double_sided,
        binding_type=req.binding_type,
        delivery_address=req.delivery_address,
        delivery_location=req.delivery_location,
        customer_phone=phone,
        special_instructions=req.special_instructions,
        payment_method=req.payment_method,
        upi_transaction_id=req.upi_transaction_id,
    )



    order = await order_crud.create_print_order(customer_id=str(current_user.id), obj_in=order_in)

    return APIResponse(
        success=True,
        message="Print service order confirmed and placed successfully! Delivery partners within 1 KM radius are being alerted.",
        data=OrderResponse.model_validate(order),
    )


