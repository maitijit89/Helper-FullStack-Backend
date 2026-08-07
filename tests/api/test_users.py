import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_read_user_me(client: AsyncClient, normal_user_token_headers: dict):
    response = await client.get(
        "/api/v1/users/me", headers=normal_user_token_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["email"] == "testuser@example.com"


@pytest.mark.asyncio
async def test_read_user_me_unauthorized(client: AsyncClient):
    response = await client.get("/api/v1/users/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_logout_user(client: AsyncClient, normal_user_token_headers: dict):
    response = await client.post(
        "/api/v1/auth/logout", headers=normal_user_token_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "logged_out"


@pytest.mark.asyncio
async def test_delete_user_me(client: AsyncClient, normal_user_token_headers: dict):
    # Step 1: Delete current user
    response = await client.delete(
        "/api/v1/users/me", headers=normal_user_token_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "deleted"

    # Step 2: Verify user no longer exists
    get_res = await client.get(
        "/api/v1/users/me", headers=normal_user_token_headers
    )
    assert get_res.status_code == 401


@pytest.mark.asyncio
async def test_update_user_location_success(
    client: AsyncClient, normal_user_token_headers: dict
):
    payload = {
        "latitude": 28.6139,
        "longitude": 77.2090,
        "is_gps_enabled": True,
        "address": "Connaught Place, New Delhi",
    }
    response = await client.put(
        "/api/v1/users/me/location",
        json=payload,
        headers=normal_user_token_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["is_gps_enabled"] is True
    assert data["data"]["location"]["latitude"] == 28.6139
    assert data["data"]["location"]["longitude"] == 77.2090
    assert data["data"]["location"]["address"] == "Connaught Place, New Delhi"


@pytest.mark.asyncio
async def test_update_user_location_gps_off_error(
    client: AsyncClient, normal_user_token_headers: dict
):
    payload = {
        "latitude": 28.6139,
        "longitude": 77.2090,
        "is_gps_enabled": False,
    }
    response = await client.put(
        "/api/v1/users/me/location",
        json=payload,
        headers=normal_user_token_headers,
    )
    assert response.status_code == 422

