import pytest
from httpx import AsyncClient
from app.crud import user_crud
from app.schemas.partner import DeliveryMode, PartnerCreate


@pytest.mark.asyncio
async def test_admin_otp_login_flow(client: AsyncClient):
    admin_email = "helpingservicesteam@gmail.com"
    # Step 1: Request Admin OTP
    req_res = await client.post(
        "/api/v1/auth/admin/request-otp",
        json={"email": admin_email},
    )
    assert req_res.status_code == 200
    req_data = req_res.json()
    assert req_data["success"] is True
    dev_otp = req_data["data"]["dev_otp"]
    assert dev_otp is not None

    # Step 2: Verify Admin OTP
    verify_res = await client.post(
        "/api/v1/auth/admin/verify-otp",
        json={"email": admin_email, "otp": dev_otp},
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["success"] is True
    admin_token = verify_data["data"]["access_token"]
    assert admin_token is not None

    # Step 3: Access Admin Protected Route with token
    headers = {"Authorization": f"Bearer {admin_token}"}
    users_res = await client.get("/api/v1/admin/users", headers=headers)
    assert users_res.status_code == 200
    assert users_res.json()["success"] is True

    # Step 4: Admin Logout
    logout_res = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout_res.status_code == 200
    assert logout_res.json()["success"] is True


@pytest.mark.asyncio
async def test_admin_otp_login_unauthorized_email(client: AsyncClient):
    req_res = await client.post(
        "/api/v1/auth/admin/request-otp",
        json={"email": "unauthorized@example.com"},
    )
    assert req_res.status_code == 400
    assert req_res.json()["success"] is False


@pytest.mark.asyncio
async def test_list_all_users_admin(
    client: AsyncClient, admin_token_headers: dict, test_user
):
    response = await client.get(
        "/api/v1/admin/users", headers=admin_token_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]) >= 1


@pytest.mark.asyncio
async def test_verify_partner_admin(
    client: AsyncClient, admin_token_headers: dict
):
    partner_in = PartnerCreate(
        name="Pending Partner",
        dob="1995-10-10",
        email="pendingpartner@example.com",
        phone="+919876543210",
        college="Tech University",
        current_address="Current Addr",
        permanent_address="Perm Addr",
        delivery_mode=DeliveryMode.CYCLE,
    )
    partner = await user_crud.create_partner_application(obj_in=partner_in)

    response = await client.patch(
        f"/api/v1/admin/partners/{str(partner.id)}/verify",
        json={"status": "approved"},
        headers=admin_token_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["partner_id"].startswith("PRT-")
    assert data["data"]["initial_password"] is not None
