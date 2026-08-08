import io
import pytest
from httpx import AsyncClient
from app.schemas.partner import PartnerVerificationStatus


@pytest.mark.asyncio
async def test_partner_signup_with_documents(client: AsyncClient):
    """Test partner signup uploading Aadhaar, PAN, and Selfie files via multipart/form-data."""
    aadhaar_file = ("aadhaar.jpg", b"fake_aadhaar_image_content", "image/jpeg")
    pan_file = ("pan.png", b"fake_pan_image_content", "image/png")
    selfie_file = ("selfie.jpg", b"fake_selfie_image_content", "image/jpeg")

    data = {
        "name": "Rohan Sharma",
        "dob": "1999-04-10",
        "email": "rohan.sharma@example.com",
        "phone": "+919876543211",
        "college": "IIT Bombay",
        "current_address": "Hostel 12, IIT Bombay, Powai",
        "permanent_address": "Flat 402, Sunshine Towers, Delhi",
        "delivery_mode": "cycle",
        "aadhaar_number": "1234-5678-9012",
        "pan_number": "ABCDE1234F",
    }

    files = {
        "aadhaar_file": aadhaar_file,
        "pan_file": pan_file,
        "selfie_file": selfie_file,
    }

    response = await client.post("/api/v1/auth/signup/partner", data=data, files=files)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["success"] is True

    partner_data = res_json["data"]
    assert partner_data["email"] == "rohan.sharma@example.com"
    profile = partner_data["partner_profile"]
    assert profile["aadhaar_number"] == "1234-5678-9012"
    assert profile["pan_number"] == "ABCDE1234F"
    assert profile["aadhaar_url"] is not None
    assert profile["pan_url"] is not None
    assert profile["selfie_url"] is not None
    assert profile["verification_status"] == PartnerVerificationStatus.PENDING.value


@pytest.mark.asyncio
async def test_admin_partner_workflow(client: AsyncClient, admin_token_headers: dict):
    """Test Admin listing partners, patching partner details, and approving partner."""
    # 1. Create a partner via multipart signup
    data = {
        "name": "Amit Kumar",
        "dob": "1997-08-15",
        "email": "amit.kumar@example.com",
        "phone": "+919811122233",
        "college": "Delhi University",
        "current_address": "North Campus, Delhi",
        "permanent_address": "Civil Lines, Delhi",
        "delivery_mode": "walking",
        "aadhaar_number": "9876-5432-1098",
        "pan_number": "XYZPD9876K",
    }
    files = {
        "aadhaar_file": ("aadhaar.jpg", b"aadhaar_bytes", "image/jpeg"),
        "pan_file": ("pan.jpg", b"pan_bytes", "image/jpeg"),
        "selfie_file": ("selfie.jpg", b"selfie_bytes", "image/jpeg"),
    }
    signup_resp = await client.post("/api/v1/auth/signup/partner", data=data, files=files)
    assert signup_resp.status_code == 201
    partner_id = signup_resp.json()["data"]["id"]

    # 2. Admin lists partners
    list_resp = await client.get("/api/v1/admin/partners?status=pending", headers=admin_token_headers)
    assert list_resp.status_code == 200
    partners = list_resp.json()["data"]
    assert any(p["id"] == partner_id for p in partners)

    # 3. Admin fetches partner details
    detail_resp = await client.get(f"/api/v1/admin/partners/{partner_id}", headers=admin_token_headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()["data"]
    assert detail["partner_profile"]["aadhaar_url"] is not None

    # 4. Admin patches partner details
    patch_data = {
        "phone": "+919811122299",
        "current_address": "Updated South Campus, Delhi",
    }
    patch_resp = await client.patch(
        f"/api/v1/admin/partners/{partner_id}",
        json=patch_data,
        headers=admin_token_headers,
    )
    assert patch_resp.status_code == 200
    updated_partner = patch_resp.json()["data"]
    assert updated_partner["partner_profile"]["phone"] == "+919811122299"
    assert updated_partner["partner_profile"]["current_address"] == "Updated South Campus, Delhi"

    # 5. Admin approves partner account
    verify_data = {"status": "approved"}
    verify_resp = await client.patch(
        f"/api/v1/admin/partners/{partner_id}/verify",
        json=verify_data,
        headers=admin_token_headers,
    )
    assert verify_resp.status_code == 200
    verify_json = verify_resp.json()
    assert verify_json["success"] is True
    assert verify_json["data"]["partner_id"].startswith("PRT-")
    assert verify_json["data"]["initial_password"] is not None
