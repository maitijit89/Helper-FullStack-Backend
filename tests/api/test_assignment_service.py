import pytest
from httpx import AsyncClient
from tests.api.test_print_page_counter_engine import create_sample_pdf_bytes


@pytest.mark.asyncio
async def test_assignment_writer_instant_price_calculation(client: AsyncClient):
    # Calculate price for 10 pages, A4 Ruled, Loose paper
    res_loose = await client.post(
        "/api/v1/assignment-service/calculate-price",
        json={
            "num_pages": 10,
            "paper_type": "a4_ruled",
            "binding_type": "none",
            "ink_color": "blue",
        },
    )
    assert res_loose.status_code == 200
    data_loose = res_loose.json()["data"]
    # Writing cost: 10 * 5.0 = 50.0; Paper cost: 10 * 1.0 = 10.0; Binding: 0. Total items: 60.0, Delivery: 25.0, Total: 85.0
    assert data_loose["writing_cost"] == 50.0
    assert data_loose["paper_cost"] == 10.0
    assert data_loose["binding_cost"] == 0.0
    assert data_loose["items_total"] == 60.0
    assert data_loose["total_amount"] == 85.0

    # Calculate price for 5 pages, Practical Sheet, Spiral File
    res_spiral = await client.post(
        "/api/v1/assignment-service/calculate-price",
        json={
            "num_pages": 5,
            "paper_type": "practical_sheet",
            "binding_type": "spiral",
            "ink_color": "black",
        },
    )
    assert res_spiral.status_code == 200
    data_spiral = res_spiral.json()["data"]
    # Writing: 5 * 5.0 = 25.0; Paper: 5 * 2.0 = 10.0; Spiral binding: 30.0; Items total: 65.0
    assert data_spiral["writing_cost"] == 25.0
    assert data_spiral["paper_cost"] == 10.0
    assert data_spiral["binding_cost"] == 30.0
    assert data_spiral["items_total"] == 65.0
    assert data_spiral["total_amount"] == 90.0

    # Calculate price for 5 pages, A4 Ruled, Channel File
    res_channel = await client.post(
        "/api/v1/assignment-service/calculate-price",
        json={
            "num_pages": 5,
            "paper_type": "a4_ruled",
            "binding_type": "channel_file",
            "ink_color": "blue_black",
        },
    )
    assert res_channel.status_code == 200
    data_channel = res_channel.json()["data"]
    # Writing: 25.0; Paper: 5.0; Channel File binding: 20.0; Items total: 50.0
    assert data_channel["binding_cost"] == 20.0
    assert data_channel["items_total"] == 50.0


@pytest.mark.asyncio
async def test_assignment_writer_upload_and_order_workflow(
    client: AsyncClient, test_user, normal_user_token_headers, partner_user, partner_token_headers
):
    # 1. Upload reference document (2-page PDF)
    pdf_bytes = create_sample_pdf_bytes(num_pages=2)
    files = {"file": ("assignment_questions.pdf", pdf_bytes, "application/pdf")}

    upload_res = await client.post(
        "/api/v1/assignment-service/upload-reference",
        files=files,
        headers=normal_user_token_headers,
    )
    assert upload_res.status_code == 201
    upload_data = upload_res.json()["data"]
    assert upload_data["detected_page_count"] == 2
    file_url = upload_data["file_url"]

    # 2. Confirm & Place Assignment Order (10 pages, practical sheet, channel file)
    confirm_res = await client.post(
        "/api/v1/assignment-service/confirm-order",
        json={
            "file_url": file_url,
            "document_name": "Physics Lab Assignment",
            "is_physical_pickup": False,
            "num_pages": 10,
            "paper_type": "practical_sheet",
            "binding_type": "channel_file",
            "ink_color": "blue",
            "delivery_address": "Engineering Hostel Block B, Room 304",
            "delivery_location": {
                "latitude": 19.0760,
                "longitude": 72.8770,
                "is_gps_enabled": True,
            },
            "customer_phone": "+919876543210",
            "payment_method": "upi",
            "upi_transaction_id": "UPI_ASSIGNMENT_999",
            "special_instructions": "Please use neat handwriting with clear section headings.",
        },
        headers=normal_user_token_headers,
    )
    assert confirm_res.status_code == 201
    order_data = confirm_res.json()["data"]
    assert order_data["order_type"] == "assignment_writer"
    assert order_data["payment_status"] == "paid"
    assert order_data["assignment_spec"]["num_pages"] == 10
    assert order_data["assignment_spec"]["paper_type"] == "practical_sheet"
    assert order_data["assignment_spec"]["binding_type"] == "channel_file"

    order_id = order_data["order_id"]

    # 3. Delivery / Writer Partner accepts the order
    accept_res = await client.patch(
        f"/api/v1/orders/{order_id}/accept",
        headers=partner_token_headers,
    )
    assert accept_res.status_code == 200
    accepted_order = accept_res.json()["data"]
    assert accepted_order["status"] == "accepted"
    assert accepted_order["partner_id"] == str(partner_user.id)
