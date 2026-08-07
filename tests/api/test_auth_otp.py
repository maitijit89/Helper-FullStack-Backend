import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_customer_signup_and_verify_otp(client: AsyncClient):
    payload = {
        "name": "John Doe",
        "dob": "2001-04-12",
        "gender": "male",
        "email": "johndoe@example.com",
        "phone": "+919876543210",
        "college": "Oxford University",
        "address": "45 College Road, Oxford",
    }
    # Step 1: Customer Signup
    signup_res = await client.post("/api/v1/auth/signup/user", json=payload)
    assert signup_res.status_code == 201
    signup_data = signup_res.json()
    assert signup_data["success"] is True
    dev_otp = signup_data["data"]["dev_otp"]
    assert dev_otp is not None

    # Step 2: Verify Registration OTP
    verify_res = await client.post(
        "/api/v1/auth/verify-otp",
        json={"email": payload["email"], "otp": dev_otp},
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["success"] is True
    assert "access_token" in verify_data["data"]

    # Step 3: Check authenticated profile
    token = verify_data["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me_res = await client.get("/api/v1/users/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["data"]["email"] == payload["email"]
    assert me_data["data"]["name"] == payload["name"]
    assert me_data["data"]["dob"] == payload["dob"]
    assert me_data["data"]["gender"] == payload["gender"]
    assert me_data["data"]["phone"] == payload["phone"]
    assert me_data["data"]["college"] == payload["college"]
    assert me_data["data"]["address"] == payload["address"]
    assert me_data["data"]["is_email_verified"] is True


@pytest.mark.asyncio
async def test_passwordless_otp_login(client: AsyncClient, test_user):
    # Step 1: Request Login OTP
    req_res = await client.post(
        "/api/v1/auth/login/request-otp",
        json={"email": "testuser@example.com"},
    )
    assert req_res.status_code == 200
    req_data = req_res.json()
    assert req_data["success"] is True
    dev_otp = req_data["data"]["dev_otp"]
    assert dev_otp is not None

    # Step 2: Verify Login OTP
    login_res = await client.post(
        "/api/v1/auth/login/verify-otp",
        json={"email": "testuser@example.com", "otp": dev_otp},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["success"] is True
    assert "access_token" in login_data["data"]


@pytest.mark.asyncio
async def test_invalid_otp_fails(client: AsyncClient, test_user):
    verify_res = await client.post(
        "/api/v1/auth/login/verify-otp",
        json={"email": "testuser@example.com", "otp": "000000"},
    )
    assert verify_res.status_code == 400
    data = verify_res.json()
    assert data["success"] is False
