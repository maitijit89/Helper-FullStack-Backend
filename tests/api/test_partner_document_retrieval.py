import io
import pypdf
import pytest
from httpx import AsyncClient
from app.core.security import create_access_token
from app.crud.crud_user import user_crud
from app.schemas.partner import DeliveryMode, PartnerCreate
from app.schemas.role import UserRole


def create_sample_pdf_bytes(num_pages: int = 2) -> bytes:
    writer = pypdf.PdfWriter()
    for _ in range(num_pages):
        writer.add_blank_page(width=595, height=842)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_partner_get_and_download_print_document_after_order_accept(
    client: AsyncClient, test_user, normal_user_token_headers
):
    # 1. Partner registration & approval
    partner_app = await user_crud.create_partner_application(
        obj_in=PartnerCreate(
            name="Xerox Partner Driver",
            dob="1995-05-05",
            email="xeroxpartner@example.com",
            phone="+919876543210",
            college="Partner College",
            current_address="Partner Address",
            permanent_address="Partner Address",
            delivery_mode=DeliveryMode.CYCLE,
        )
    )
    partner, partner_id, initial_password = await user_crud.approve_partner(db_obj=partner_app)

    # 2. Customer uploads a 2-page PDF document
    pdf_bytes = create_sample_pdf_bytes(num_pages=2)
    files = {"file": ("final_report.pdf", pdf_bytes, "application/pdf")}

    upload_res = await client.post(
        "/api/v1/print/upload-document",
        files=files,
        headers=normal_user_token_headers,
    )
    assert upload_res.status_code == 201
    file_url = upload_res.json()["data"]["file_url"]

    # 3. Customer places print order
    confirm_res = await client.post(
        "/api/v1/print/confirm-order",
        json={
            "file_url": file_url,
            "document_name": "final_report.pdf",
            "confirmed_num_pages": 2,
            "num_copies": 1,
            "color_mode": "color",
            "paper_size": "A4",
            "is_double_sided": True,
            "binding_type": "spiral",
            "delivery_address": "Engineering Block A",
            "delivery_location": {
                "latitude": 19.0740,
                "longitude": 72.8750,
                "is_gps_enabled": True,
            },
            "customer_phone": "+919876543210",
            "payment_method": "upi",
            "upi_transaction_id": "UPI_XEROX_888",
            "special_instructions": "Please print in high resolution",
        },
        headers=normal_user_token_headers,
    )
    assert confirm_res.status_code == 201
    order_id = confirm_res.json()["data"]["order_id"]

    # 4. Partner sets location (GPS ON) and accepts order
    partner_token = create_access_token(subject=str(partner.id), role=UserRole.PARTNER)
    partner_headers = {"Authorization": f"Bearer {partner_token}"}

    await client.put(
        "/api/v1/partner/location",
        json={
            "latitude": 19.0750,
            "longitude": 72.8760,
            "is_gps_enabled": True,
            "address": "Partner Shop Location",
        },
        headers=partner_headers,
    )

    accept_res = await client.patch(f"/api/v1/orders/{order_id}/accept", headers=partner_headers)
    assert accept_res.status_code == 200

    # 5. Partner fetches document print specifications
    doc_res = await client.get(f"/api/v1/orders/{order_id}/document", headers=partner_headers)
    assert doc_res.status_code == 200
    doc_data = doc_res.json()["data"]
    assert doc_data["order_id"] == order_id
    assert doc_data["document_name"] == "final_report.pdf"
    assert doc_data["color_mode"] == "color"
    assert doc_data["num_pages"] == 2
    assert doc_data["binding_type"] == "spiral"
    assert doc_data["special_instructions"] == "Please print in high resolution"
    assert "download_url" in doc_data

    # 6. Partner downloads raw binary document file to perform printout/Xerox
    dl_res = await client.get(f"/api/v1/orders/{order_id}/download-document", headers=partner_headers)
    assert dl_res.status_code == 200
    assert len(dl_res.content) > 0
    assert dl_res.headers["content-disposition"].find("final_report.pdf") != -1

    # 7. Unassigned partner tries to fetch document -> 403 Forbidden
    other_app = await user_crud.create_partner_application(
        obj_in=PartnerCreate(
            name="Other Partner",
            dob="1996-06-06",
            email="otherpartner@example.com",
            phone="+919876543211",
            college="Partner College 2",
            current_address="Partner Address 2",
            permanent_address="Partner Address 2",
            delivery_mode=DeliveryMode.CYCLE,
        )
    )
    other_partner, _, _ = await user_crud.approve_partner(db_obj=other_app)
    other_token = create_access_token(subject=str(other_partner.id), role=UserRole.PARTNER)
    other_headers = {"Authorization": f"Bearer {other_token}"}

    forbidden_res = await client.get(f"/api/v1/orders/{order_id}/document", headers=other_headers)
    assert forbidden_res.status_code == 403
