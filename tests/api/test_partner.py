import pytest
from httpx import AsyncClient
from app.crud import user_crud
from app.schemas.partner import DeliveryMode, PartnerCreate, PartnerVerificationStatus


@pytest.mark.asyncio
async def test_partner_application_and_approval_flow(client: AsyncClient, admin_token_headers: dict):
    # Step 1: Partner Application
    app_payload = {
        "name": "Delivery Hero",
        "dob": "1999-08-10",
        "email": "hero@delivery.com",
        "phone": "+919123456789",
        "college": "National Institute",
        "current_address": "12 North Street",
        "permanent_address": "88 South Village",
        "delivery_mode": "cycle",
    }
    signup_res = await client.post("/api/v1/auth/signup/partner", json=app_payload)
    assert signup_res.status_code == 201
    signup_data = signup_res.json()
    assert signup_data["success"] is True
    user_id = signup_data["data"]["id"]

    # Step 2: Attempt duplicate application within 7 days -> Expect 400 Bad Request
    dup_res = await client.post("/api/v1/auth/signup/partner", json=app_payload)
    assert dup_res.status_code == 400
    assert "7 days" in dup_res.json()["error"]["message"]

    # Step 3: Admin approves partner application
    verify_payload = {"status": "approved"}
    approve_res = await client.patch(
        f"/api/v1/admin/partners/{user_id}/verify",
        json=verify_payload,
        headers=admin_token_headers,
    )
    assert approve_res.status_code == 200
    approve_data = approve_res.json()
    assert approve_data["success"] is True
    assigned_partner_id = approve_data["data"]["partner_id"]
    initial_password = approve_data["data"]["initial_password"]
    assert assigned_partner_id.startswith("PRT-")
    assert initial_password is not None

    # Step 4: Partner login using Partner ID and assigned initial password
    login_res = await client.post(
        "/api/v1/auth/partner/login",
        json={"partner_id_or_email": assigned_partner_id, "password": initial_password},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    token = login_data["data"]["access_token"]
    partner_headers = {"Authorization": f"Bearer {token}"}

    # Step 5: Partner changes password
    new_password = "NewSuperPassword123!"
    change_res = await client.put(
        "/api/v1/partner/change-password",
        json={"previous_password": initial_password, "new_password": new_password},
        headers=partner_headers,
    )
    assert change_res.status_code == 200
    assert change_res.json()["success"] is True

    # Step 6: Partner logs in with new password
    new_login_res = await client.post(
        "/api/v1/auth/partner/login",
        json={"partner_id_or_email": assigned_partner_id, "password": new_password},
    )
    assert new_login_res.status_code == 200


@pytest.mark.asyncio
async def test_partner_rejection_flow(client: AsyncClient, admin_token_headers: dict):
    app_payload = {
        "name": "Rejected Driver",
        "dob": "1997-03-15",
        "email": "rejected@delivery.com",
        "phone": "+919000000000",
        "college": "City College",
        "current_address": "Address 1",
        "permanent_address": "Address 2",
        "delivery_mode": "walking",
    }
    signup_res = await client.post("/api/v1/auth/signup/partner", json=app_payload)
    assert signup_res.status_code == 201
    user_id = signup_res.json()["data"]["id"]

    # Admin rejects
    reject_res = await client.patch(
        f"/api/v1/admin/partners/{user_id}/verify",
        json={"status": "rejected", "rejection_reason": "Incomplete documents"},
        headers=admin_token_headers,
    )
    assert reject_res.status_code == 200
    reject_data = reject_res.json()
    assert reject_data["data"]["partner_id"] is None
    assert "rejected" in reject_data["message"].lower()


@pytest.mark.asyncio
async def test_partner_location_and_online_toggle(client: AsyncClient, admin_token_headers: dict):
    # Step 1: Create and approve partner
    app_payload = {
        "name": "GPS Partner",
        "dob": "1998-01-01",
        "email": "gpspartner@delivery.com",
        "phone": "+919888877776",
        "college": "Tech College",
        "current_address": "Tech Park",
        "permanent_address": "Home Town",
        "delivery_mode": "cycle",
    }
    signup_res = await client.post("/api/v1/auth/signup/partner", json=app_payload)
    user_id = signup_res.json()["data"]["id"]

    approve_res = await client.patch(
        f"/api/v1/admin/partners/{user_id}/verify",
        json={"status": "approved"},
        headers=admin_token_headers,
    )
    assigned_partner_id = approve_res.json()["data"]["partner_id"]
    initial_password = approve_res.json()["data"]["initial_password"]

    login_res = await client.post(
        "/api/v1/auth/partner/login",
        json={"partner_id_or_email": assigned_partner_id, "password": initial_password},
    )
    token = login_res.json()["data"]["access_token"]
    partner_headers = {"Authorization": f"Bearer {token}"}

    # Step 2: Attempt to toggle online BEFORE enabling GPS -> Expect 400 Bad Request
    online_res_fail = await client.patch(
        "/api/v1/partner/toggle-online?is_online=true",
        headers=partner_headers,
    )
    assert online_res_fail.status_code == 400
    assert "GPS" in online_res_fail.json()["error"]["message"]

    # Step 3: Update partner GPS location
    loc_payload = {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "is_gps_enabled": True,
        "address": "MG Road, Bangalore",
    }
    loc_res = await client.put(
        "/api/v1/partner/location",
        json=loc_payload,
        headers=partner_headers,
    )
    assert loc_res.status_code == 200
    assert loc_res.json()["data"]["is_gps_enabled"] is True

    # Step 4: Toggle online AFTER updating GPS location -> Expect 200 OK
    online_res_success = await client.patch(
        "/api/v1/partner/toggle-online?is_online=true",
        headers=partner_headers,
    )
    assert online_res_success.status_code == 200
    assert online_res_success.json()["data"]["partner_profile"]["is_online"] is True

