from unittest.mock import MagicMock, patch
import pytest
from httpx import AsyncClient
from app.models.order import Order, OrderStatus, OrderType, PaymentMethod, PaymentStatus
from app.schemas.role import UserRole


@pytest.fixture
async def sample_order(test_user) -> Order:
    """Create a sample product order for testing."""
    order = Order(
        order_id="ORD-ADMIN-TEST-100",
        customer_id=str(test_user.id),
        order_type=OrderType.PRODUCT_ORDER,
        status=OrderStatus.PENDING,
        items_total=300.0,
        delivery_fee=25.0,
        total_amount=325.0,
        payment_method=PaymentMethod.RAZORPAY,
        payment_status=PaymentStatus.PAID,
        razorpay_order_id="order_dummy_123",
        razorpay_payment_id="pay_dummy_456",
    )
    await order.insert()
    return order


@pytest.mark.asyncio
async def test_admin_list_and_filter_orders(
    client: AsyncClient,
    admin_token_headers,
    sample_order,
):
    """Test Admin listing all orders with filters."""
    # List all
    res = await client.get("/api/v1/admin/orders", headers=admin_token_headers)
    assert res.status_code == 200
    assert len(res.json()["data"]) >= 1

    # Filter by status
    res_status = await client.get(
        "/api/v1/admin/orders?status=pending",
        headers=admin_token_headers,
    )
    assert res_status.status_code == 200
    assert all(o["status"] == "pending" for o in res_status.json()["data"])

    # Filter by order type
    res_type = await client.get(
        "/api/v1/admin/orders?order_type=product_order",
        headers=admin_token_headers,
    )
    assert res_type.status_code == 200


@pytest.mark.asyncio
async def test_admin_get_order_details_and_force_assign(
    client: AsyncClient,
    admin_token_headers,
    sample_order,
    partner_user,
):
    """Test Admin getting single order details and force-assigning to a partner."""
    # Get details
    res = await client.get(
        f"/api/v1/admin/orders/{sample_order.order_id}",
        headers=admin_token_headers,
    )
    assert res.status_code == 200
    assert res.json()["data"]["order_id"] == sample_order.order_id

    # Force assign partner
    assign_res = await client.post(
        f"/api/v1/admin/orders/{sample_order.order_id}/assign-partner?partner_id={str(partner_user.id)}",
        headers=admin_token_headers,
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["data"]["partner_id"] == str(partner_user.id)
    assert assign_res.json()["data"]["status"] == "assigned"


@pytest.mark.asyncio
async def test_admin_user_moderation(
    client: AsyncClient,
    admin_token_headers,
    test_user,
):
    """Test Admin updating user active status, role, and deletion."""
    user_id = str(test_user.id)

    # 1. Suspend / deactivate user
    status_res = await client.patch(
        f"/api/v1/admin/users/{user_id}/status?is_active=false",
        headers=admin_token_headers,
    )
    assert status_res.status_code == 200
    assert status_res.json()["data"]["is_active"] is False

    # 2. Re-activate user
    status_res2 = await client.patch(
        f"/api/v1/admin/users/{user_id}/status?is_active=true",
        headers=admin_token_headers,
    )
    assert status_res2.status_code == 200
    assert status_res2.json()["data"]["is_active"] is True

    # 3. Update role
    role_res = await client.patch(
        f"/api/v1/admin/users/{user_id}/role?role=partner",
        headers=admin_token_headers,
    )
    assert role_res.status_code == 200
    assert role_res.json()["data"]["role"] == "partner"


@pytest.mark.asyncio
async def test_razorpay_refund_endpoint(
    client: AsyncClient,
    admin_token_headers,
    sample_order,
):
    """Test POST /api/v1/payments/razorpay/refund."""
    with patch("app.services.razorpay_service.razorpay_service.refund_payment") as mock_refund:
        mock_refund.return_value = {"id": "rfnd_test_12345", "amount": 32500, "status": "processed"}

        payload = {
            "order_id": sample_order.order_id,
            "amount": 325.0,
            "reason": "Customer cancellation refund",
        }
        res = await client.post(
            "/api/v1/payments/razorpay/refund",
            json=payload,
            headers=admin_token_headers,
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["success"] is True
        assert data["refund_id"] == "rfnd_test_12345"
        assert data["amount_refunded"] == 325.0

        # Verify order payment status updated
        refreshed_order = await Order.find_one(Order.order_id == sample_order.order_id)
        assert refreshed_order.payment_status == PaymentStatus.FAILED


@pytest.mark.asyncio
async def test_partner_earnings_analytics(
    client: AsyncClient,
    partner_token_headers,
    partner_user,
):
    """Test GET /api/v1/partner/wallet/earnings-history."""
    from app.services.wallet_service import wallet_service

    # Credit sample earnings
    await wallet_service.credit_partner_earnings(
        partner_id=str(partner_user.id),
        order_id="ORD-EARN-1",
        delivery_fee=50.0,
    )
    await wallet_service.credit_partner_earnings(
        partner_id=str(partner_user.id),
        order_id="ORD-EARN-2",
        delivery_fee=35.0,
    )

    res = await client.get(
        "/api/v1/partner/wallet/earnings-history",
        headers=partner_token_headers,
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["total_balance"] == 85.0
    assert data["holding_balance"] == 85.0
    assert data["total_completed_trips"] == 2
    assert len(data["daily_history"]) >= 1
