import io
import os
import pypdf
import pytest
from httpx import AsyncClient
from app.services.page_counter_service import page_counter_engine


def create_sample_pdf_bytes(num_pages: int = 3) -> bytes:
    """Helper to generate a valid multi-page PDF in memory."""
    writer = pypdf.PdfWriter()
    for _ in range(num_pages):
        writer.add_blank_page(width=595, height=842)  # A4 size
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_page_counter_engine_pdf_and_range():
    # 1. Generate 4-page PDF
    pdf_bytes = create_sample_pdf_bytes(num_pages=4)
    tmp_path = "uploads/test_sample_4pages.pdf"
    os.makedirs("uploads", exist_ok=True)
    with open(tmp_path, "wb") as f:
        f.write(pdf_bytes)

    try:
        # Count pages using engine
        count, method = page_counter_engine.count_pages(tmp_path, "test_sample_4pages.pdf")
        assert count == 4
        assert method in ["pdf", "pdf_regex"]

        # Parse page ranges
        assert page_counter_engine.parse_page_range("1-2", 4) == 2
        assert page_counter_engine.parse_page_range("1, 3, 4", 4) == 3
        assert page_counter_engine.parse_page_range("all", 4) == 4
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@pytest.mark.asyncio
async def test_print_document_upload_recount_and_confirm_workflow(
    client: AsyncClient, test_user, normal_user_token_headers
):
    # 1. Create a 3-page test PDF in memory
    pdf_bytes = create_sample_pdf_bytes(num_pages=3)
    files = {"file": ("my_assignment.pdf", pdf_bytes, "application/pdf")}

    # Upload document
    upload_res = await client.post(
        "/api/v1/print/upload-document",
        files=files,
        headers=normal_user_token_headers,
    )
    assert upload_res.status_code == 201
    upload_data = upload_res.json()["data"]
    assert upload_data["detected_page_count"] == 3
    file_url = upload_data["file_url"]

    # 2. Recount pages: User wants only pages 1 to 2 printed
    recount_res = await client.post(
        "/api/v1/print/recount",
        json={
            "file_url": file_url,
            "document_name": "my_assignment.pdf",
            "total_detected_pages": 3,
            "page_range": "1-2",
            "color_mode": "color",
            "num_copies": 1,
            "binding_type": "spiral",
        },
        headers=normal_user_token_headers,
    )
    assert recount_res.status_code == 200
    recount_data = recount_res.json()["data"]
    assert recount_data["final_page_count"] == 2
    # Cost: 2 color pages @ 10.0 = 20.0 + spiral binding 30.0 = 50.0 items total
    assert recount_data["cost_breakdown"]["items_total"] == 50.0

    # 3. Manual Page Override Recount
    override_res = await client.post(
        "/api/v1/print/recount",
        json={
            "file_url": file_url,
            "document_name": "my_assignment.pdf",
            "total_detected_pages": 3,
            "manual_page_override": 5,
            "color_mode": "black_and_white",
            "num_copies": 2,
            "binding_type": "none",
        },
        headers=normal_user_token_headers,
    )
    assert override_res.status_code == 200
    assert override_res.json()["data"]["final_page_count"] == 5

    # 4. User clicks OK / Confirm Order
    confirm_res = await client.post(
        "/api/v1/print/confirm-order",
        json={
            "file_url": file_url,
            "document_name": "my_assignment.pdf",
            "confirmed_num_pages": 5,
            "num_copies": 1,
            "color_mode": "black_and_white",
            "paper_size": "A4",
            "is_double_sided": False,
            "binding_type": "spiral",
            "delivery_address": "Campus Hostel Room 102",
            "delivery_location": {
                "latitude": 19.0740,
                "longitude": 72.8750,
                "is_gps_enabled": True,
            },
            "customer_phone": "+919876543210",
            "payment_method": "upi",
            "upi_transaction_id": "UPI_PRINT_123",
        },
        headers=normal_user_token_headers,
    )
    assert confirm_res.status_code == 201
    order_data = confirm_res.json()["data"]
    assert order_data["order_type"] == "print_service"
    assert order_data["payment_method"] == "upi"
    assert order_data["payment_status"] == "paid"
    assert order_data["print_spec"]["num_pages"] == 5
    assert order_data["print_spec"]["binding_type"] == "spiral"


@pytest.mark.asyncio
async def test_print_options_instant_price_calculation(client: AsyncClient):
    # Test B&W calculation for 10 pages
    bw_res = await client.post(
        "/api/v1/print/calculate-price",
        json={
            "num_pages": 10,
            "num_copies": 1,
            "color_mode": "black_and_white",
            "paper_size": "A4",
            "is_double_sided": False,
            "binding_type": "none",
        },
    )
    assert bw_res.status_code == 200
    bw_data = bw_res.json()["data"]
    # 10 pages @ RS 2.0 = RS 20.0 print cost
    assert bw_data["print_cost"] == 20.0
    assert bw_data["color_mode"] == "black_and_white"

    # Test Color mode calculation for 10 pages
    color_res = await client.post(
        "/api/v1/print/calculate-price",
        json={
            "num_pages": 10,
            "num_copies": 1,
            "color_mode": "color",
            "paper_size": "A4",
            "is_double_sided": False,
            "binding_type": "spiral",
        },
    )
    assert color_res.status_code == 200
    color_data = color_res.json()["data"]
    # 10 pages @ RS 10.0 = RS 100.0 print cost + 30.0 spiral = 130.0 items total
    assert color_data["print_cost"] == 100.0
    assert color_data["binding_cost"] == 30.0
    assert color_data["items_total"] == 130.0
    assert color_data["color_mode"] == "color"

