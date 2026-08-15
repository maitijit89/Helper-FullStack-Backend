import pytest
from httpx import AsyncClient
from app.models.order import Order, OrderStatus, OrderType


@pytest.fixture
async def delivered_order(test_user, partner_user) -> Order:
    """Create a sample delivered order assigned to partner_user and test_user."""
    order = Order(
        order_id="ORD-TEST-9988",
        customer_id=str(test_user.id),
        partner_id=str(partner_user.id),
        order_type=OrderType.PRODUCT_ORDER,
        status=OrderStatus.DELIVERED,
        items_total=250.0,
        delivery_fee=20.0,
        total_amount=270.0,
    )
    await order.insert()
    return order


@pytest.fixture
async def pending_order(test_user, partner_user) -> Order:
    """Create a sample pending (not delivered) order."""
    order = Order(
        order_id="ORD-TEST-PENDING",
        customer_id=str(test_user.id),
        partner_id=str(partner_user.id),
        order_type=OrderType.PRODUCT_ORDER,
        status=OrderStatus.PENDING,
        items_total=150.0,
        delivery_fee=20.0,
        total_amount=170.0,
    )
    await order.insert()
    return order


@pytest.mark.asyncio
async def test_create_partner_rating_success(
    client: AsyncClient,
    test_user,
    partner_user,
    delivered_order,
    normal_user_token_headers,
):
    """Test customer successfully rating partner for a delivered order."""
    payload = {
        "order_id": delivered_order.order_id,
        "rating": 4.5,
        "review": "Great service and fast delivery!",
        "tags": ["on_time", "polite", "fast_delivery"],
    }
    response = await client.post(
        "/api/v1/ratings/",
        json=payload,
        headers=normal_user_token_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["order_id"] == delivered_order.order_id
    assert data["data"]["rating"] == 4.5
    assert data["data"]["review"] == "Great service and fast delivery!"
    assert data["data"]["tags"] == ["on_time", "polite", "fast_delivery"]

    # Verify partner stats were updated
    refreshed_partner = await partner_user.get(partner_user.id)
    assert refreshed_partner.partner_profile.total_ratings == 1
    assert refreshed_partner.partner_profile.rating == 4.5

    # Verify order was marked as rated
    refreshed_order = await Order.find_one(Order.order_id == delivered_order.order_id)
    assert refreshed_order.is_rated is True
    assert refreshed_order.rating == 4.5
    assert refreshed_order.review == "Great service and fast delivery!"


@pytest.mark.asyncio
async def test_cannot_rate_undelivered_order(
    client: AsyncClient,
    pending_order,
    normal_user_token_headers,
):
    """Ensure rating fails if the order status is not DELIVERED."""
    payload = {
        "order_id": pending_order.order_id,
        "rating": 5.0,
        "review": "Attempting early rating",
    }
    response = await client.post(
        "/api/v1/ratings/",
        json=payload,
        headers=normal_user_token_headers,
    )
    assert response.status_code == 400
    err_msg = response.json().get("error", {}).get("message", "") or response.json().get("message", "")
    assert "delivered" in err_msg.lower()


@pytest.mark.asyncio
async def test_prevent_duplicate_rating(
    client: AsyncClient,
    delivered_order,
    normal_user_token_headers,
):
    """Test that customer cannot rate the same order twice."""
    payload = {
        "order_id": delivered_order.order_id,
        "rating": 4.0,
        "review": "First rating",
    }
    # 1st attempt
    resp1 = await client.post(
        "/api/v1/ratings/",
        json=payload,
        headers=normal_user_token_headers,
    )
    assert resp1.status_code == 201

    # 2nd attempt
    resp2 = await client.post(
        "/api/v1/ratings/",
        json=payload,
        headers=normal_user_token_headers,
    )
    assert resp2.status_code == 400
    err_msg2 = resp2.json().get("error", {}).get("message", "") or resp2.json().get("message", "")
    assert "already been rated" in err_msg2.lower()


@pytest.mark.asyncio
async def test_customer_patch_rating(
    client: AsyncClient,
    delivered_order,
    normal_user_token_headers,
    partner_user,
):
    """Test customer updating / patching their rating & review."""
    # Create initial rating
    create_resp = await client.post(
        "/api/v1/ratings/",
        json={
            "order_id": delivered_order.order_id,
            "rating": 3.0,
            "review": "Average delivery",
        },
        headers=normal_user_token_headers,
    )
    assert create_resp.status_code == 201
    rating_id = create_resp.json()["data"]["id"]

    # Patch rating
    patch_resp = await client.patch(
        f"/api/v1/ratings/{rating_id}",
        json={
            "rating": 5.0,
            "review": "Actually, delivery was super great upon checking!",
            "tags": ["careful_handling"],
        },
        headers=normal_user_token_headers,
    )
    assert patch_resp.status_code == 200
    patch_data = patch_resp.json()["data"]
    assert patch_data["rating"] == 5.0
    assert "super great" in patch_data["review"]
    assert patch_data["tags"] == ["careful_handling"]

    # Partner score updated to 5.0
    refreshed_partner = await partner_user.get(partner_user.id)
    assert refreshed_partner.partner_profile.rating == 5.0


@pytest.mark.asyncio
async def test_partner_view_ratings_and_summary(
    client: AsyncClient,
    delivered_order,
    normal_user_token_headers,
    partner_token_headers,
    partner_user,
):
    """Test delivery partner fetching their received ratings and summary."""
    # Rate the partner
    await client.post(
        "/api/v1/ratings/",
        json={
            "order_id": delivered_order.order_id,
            "rating": 5.0,
            "review": "Excellent work!",
        },
        headers=normal_user_token_headers,
    )

    # Partner fetches their reviews
    resp = await client.get("/api/v1/partner/ratings", headers=partner_token_headers)
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1
    assert resp.json()["data"][0]["rating"] == 5.0

    # Partner fetches rating summary
    summary_resp = await client.get("/api/v1/partner/ratings/summary", headers=partner_token_headers)
    assert summary_resp.status_code == 200
    summary_data = summary_resp.json()["data"]
    assert summary_data["average_rating"] == 5.0
    assert summary_data["total_ratings"] == 1
    assert summary_data["rating_distribution"]["5"] == 1


@pytest.mark.asyncio
async def test_admin_rating_moderation_and_patching(
    client: AsyncClient,
    delivered_order,
    normal_user_token_headers,
    admin_token_headers,
    partner_user,
):
    """Test Admin listing, patching, hiding, overriding, and deleting ratings."""
    # Submit rating
    create_resp = await client.post(
        "/api/v1/ratings/",
        json={
            "order_id": delivered_order.order_id,
            "rating": 1.0,
            "review": "Terrible abusive text",
        },
        headers=normal_user_token_headers,
    )
    rating_id = create_resp.json()["data"]["id"]

    # 1. Admin lists all ratings
    list_resp = await client.get("/api/v1/admin/ratings", headers=admin_token_headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()["data"]) >= 1

    # 2. Admin moderates / hides the rating
    patch_resp = await client.patch(
        f"/api/v1/admin/ratings/{rating_id}",
        json={
            "is_hidden": True,
            "admin_notes": "Hidden due to policy violation",
        },
        headers=admin_token_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["data"]["is_hidden"] is True
    assert patch_resp.json()["data"]["admin_notes"] == "Hidden due to policy violation"

    # Because rating is hidden, partner active rating resets to default
    refreshed_partner = await partner_user.get(partner_user.id)
    assert refreshed_partner.partner_profile.total_ratings == 0
    assert refreshed_partner.partner_profile.rating == 5.0

    # 3. Admin manually overrides partner rating
    override_resp = await client.patch(
        f"/api/v1/admin/partners/{str(partner_user.id)}/rating",
        json={"rating": 4.8, "total_ratings": 50},
        headers=admin_token_headers,
    )
    assert override_resp.status_code == 200
    assert override_resp.json()["data"]["partner_profile"]["rating"] == 4.8
    assert override_resp.json()["data"]["partner_profile"]["total_ratings"] == 50

    # 4. Admin deletes rating
    del_resp = await client.delete(
        f"/api/v1/admin/ratings/{rating_id}",
        headers=admin_token_headers,
    )
    assert del_resp.status_code == 200
    assert del_resp.json()["data"]["deleted"] is True
