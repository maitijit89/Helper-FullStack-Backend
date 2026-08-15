import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_customer_submit_feedback(
    client: AsyncClient,
    normal_user_token_headers: dict,
    test_user,
):
    """Test customer submitting app feedback."""
    payload = {
        "rating": 5.0,
        "category": "app_experience",
        "title": "Super fast app and easy ordering!",
        "message": "Loved the instant print service and Xerox preview features.",
        "app_version": "1.2.0",
        "device_os": "Android 14",
        "device_model": "Pixel 8",
    }
    response = await client.post(
        "/api/v1/feedback/",
        json=payload,
        headers=normal_user_token_headers,
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["user_id"] == str(test_user.id)
    assert data["role"] == "user"
    assert data["rating"] == 5.0
    assert data["category"] == "app_experience"
    assert data["title"] == "Super fast app and easy ordering!"
    assert data["status"] == "new"


@pytest.mark.asyncio
async def test_partner_submit_feedback(
    client: AsyncClient,
    partner_token_headers: dict,
    partner_user,
):
    """Test delivery partner submitting app feedback."""
    payload = {
        "rating": 4.5,
        "category": "delivery_service",
        "title": "Great dispatch routing",
        "message": "The 1KM ringing notification and GPS live tracking works seamlessly.",
        "app_version": "1.2.0",
        "device_os": "iOS 17.5",
        "device_model": "iPhone 14",
    }
    response = await client.post(
        "/api/v1/feedback/",
        json=payload,
        headers=partner_token_headers,
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["user_id"] == str(partner_user.id)
    assert data["role"] == "partner"
    assert data["rating"] == 4.5
    assert data["category"] == "delivery_service"


@pytest.mark.asyncio
async def test_get_my_feedback_history(
    client: AsyncClient,
    normal_user_token_headers: dict,
):
    """Test user fetching their own feedback submissions."""
    # Submit 2 feedbacks
    await client.post(
        "/api/v1/feedback/",
        json={"rating": 5.0, "category": "pricing", "message": "Fair pricing for Xerox."},
        headers=normal_user_token_headers,
    )
    await client.post(
        "/api/v1/feedback/",
        json={"rating": 4.0, "category": "general", "message": "Add more snacks to catalog."},
        headers=normal_user_token_headers,
    )

    response = await client.get("/api/v1/feedback/me", headers=normal_user_token_headers)
    assert response.status_code == 200
    feedbacks = response.json()["data"]
    assert len(feedbacks) >= 2


@pytest.mark.asyncio
async def test_admin_feedback_management_and_triage(
    client: AsyncClient,
    normal_user_token_headers: dict,
    partner_token_headers: dict,
    admin_token_headers: dict,
):
    """Test Admin listing, filtering, triaging, analyzing, and deleting feedbacks."""
    # Submit customer feedback
    cust_res = await client.post(
        "/api/v1/feedback/",
        json={"rating": 3.0, "category": "feature_request", "message": "Please add dark mode."},
        headers=normal_user_token_headers,
    )
    cust_fb_id = cust_res.json()["data"]["id"]

    # Submit partner feedback
    await client.post(
        "/api/v1/feedback/",
        json={"rating": 5.0, "category": "delivery_service", "message": "Partner app is smooth."},
        headers=partner_token_headers,
    )

    # 1. Admin lists all feedback
    list_res = await client.get("/api/v1/feedback/admin/all", headers=admin_token_headers)
    assert list_res.status_code == 200
    assert len(list_res.json()["data"]) >= 2

    # Filter by role
    partner_list = await client.get(
        "/api/v1/feedback/admin/all?role=partner",
        headers=admin_token_headers,
    )
    assert partner_list.status_code == 200
    assert all(f["role"] == "partner" for f in partner_list.json()["data"])

    # 2. Admin fetches analytics summary
    summary_res = await client.get("/api/v1/feedback/admin/summary", headers=admin_token_headers)
    assert summary_res.status_code == 200
    summary_data = summary_res.json()["data"]
    assert summary_data["total_feedback_count"] >= 2
    assert summary_data["customer_feedback_count"] >= 1
    assert summary_data["partner_feedback_count"] >= 1
    assert "feature_request" in summary_data["category_breakdown"]

    # 3. Admin triages / resolves customer feedback
    patch_res = await client.patch(
        f"/api/v1/feedback/admin/{cust_fb_id}",
        json={
            "status": "resolved",
            "admin_notes": "Added dark mode to v1.3 roadmap",
            "admin_response": "Thank you! Dark mode is scheduled for the upcoming release.",
        },
        headers=admin_token_headers,
    )
    assert patch_res.status_code == 200
    patched_data = patch_res.json()["data"]
    assert patched_data["status"] == "resolved"
    assert patched_data["admin_notes"] == "Added dark mode to v1.3 roadmap"
    assert "upcoming release" in patched_data["admin_response"]

    # 4. Admin deletes feedback
    del_res = await client.delete(
        f"/api/v1/feedback/admin/{cust_fb_id}",
        headers=admin_token_headers,
    )
    assert del_res.status_code == 200
    assert del_res.json()["data"]["deleted"] is True
