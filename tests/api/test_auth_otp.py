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
    assert "Invalid OTP code" in data["error"]["message"]


@pytest.mark.asyncio
async def test_resend_otp_and_already_used_otp(client: AsyncClient, test_user):
    # Step 1: Request OTP
    req_res = await client.post(
        "/api/v1/auth/login/request-otp",
        json={"email": "testuser@example.com"},
    )
    assert req_res.status_code == 200
    req_data = req_res.json()
    assert "email_sent" in req_data["data"]
    old_otp = req_data["data"]["dev_otp"]

    # Step 2: Resend OTP for login purpose
    resend_res = await client.post(
        "/api/v1/auth/resend-otp?purpose=login",
        json={"email": "testuser@example.com"},
    )
    assert resend_res.status_code == 200
    resend_data = resend_res.json()
    new_otp = resend_data["data"]["dev_otp"]
    assert new_otp is not None
    assert new_otp != old_otp

    # Step 3: Verifying with old OTP should fail
    verify_old = await client.post(
        "/api/v1/auth/login/verify-otp",
        json={"email": "testuser@example.com", "otp": old_otp},
    )
    assert verify_old.status_code == 400

    # Step 4: Verifying with new OTP should succeed
    verify_new = await client.post(
        "/api/v1/auth/login/verify-otp",
        json={"email": "testuser@example.com", "otp": new_otp},
    )
    assert verify_new.status_code == 200

    # Step 5: Trying to reuse new OTP should fail with "already been used"
    verify_reuse = await client.post(
        "/api/v1/auth/login/verify-otp",
        json={"email": "testuser@example.com", "otp": new_otp},
    )
    assert verify_reuse.status_code == 400
    assert "already been used" in verify_reuse.json()["error"]["message"]

