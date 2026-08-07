import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_signup_user(client: AsyncClient):
    payload = {
        "name": "New Customer",
        "dob": "1998-11-20",
        "gender": "female",
        "email": "newcustomer@example.com",
        "phone": "+919876500000",
        "college": "State University",
        "address": "100 Park Avenue",
    }
    response = await client.post("/api/v1/auth/signup/user", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["email"] == payload["email"]
    assert "dev_otp" in data["data"]


@pytest.mark.asyncio
async def test_signup_partner(client: AsyncClient):
    payload = {
        "name": "New Partner",
        "dob": "1996-05-12",
        "email": "newpartner@example.com",
        "phone": "+919888877777",
        "college": "Tech College",
        "current_address": "123 Current St",
        "permanent_address": "456 Permanent St",
        "delivery_mode": "cycle",
    }
    response = await client.post("/api/v1/auth/signup/partner", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["role"] == "partner"
    assert data["data"]["partner_profile"]["verification_status"] == "pending"
    assert data["data"]["partner_profile"]["delivery_mode"] == "cycle"


@pytest.mark.asyncio
async def test_login_user(client: AsyncClient, test_user):
    form_data = {
        "username": "testuser@example.com",
        "password": "TestPassword123!",
    }
    response = await client.post("/api/v1/auth/login", data=form_data)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
