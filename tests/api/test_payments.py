import hashlib
import hmac
from unittest.mock import MagicMock, patch
import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.crud.crud_order import order_crud
from app.models.order import Order, PaymentMethod, PaymentStatus, OrderType
from app.schemas.order import QuickCommerceOrderCreate
from app.schemas.order import OrderItemRequest
from app.services.razorpay_service import razorpay_service


@pytest.mark.asyncio
async def test_razorpay_service_signature_verification():
    """Unit test for RazorpayService HMAC SHA256 signature verification logic."""
    settings.RAZORPAY_KEY_SECRET = "xa9Hb62CQd3EbTIeX3RXwopA"
    razorpay_service.key_secret = "xa9Hb62CQd3EbTIeX3RXwopA"

    order_id = "order_12345"
    payment_id = "pay_67890"
    msg = f"{order_id}|{payment_id}"
    valid_sig = hmac.new(
        "xa9Hb62CQd3EbTIeX3RXwopA".encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    # Valid signature
    assert razorpay_service.verify_payment_signature(
        razorpay_order_id=order_id,
        razorpay_payment_id=payment_id,
        razorpay_signature=valid_sig,
    ) is True

    # Invalid signature
    assert razorpay_service.verify_payment_signature(
        razorpay_order_id=order_id,
        razorpay_payment_id=payment_id,
        razorpay_signature="invalid_signature_hex",
    ) is False


@pytest.mark.asyncio
async def test_create_razorpay_order_api(client: AsyncClient, test_user, normal_user_token_headers):
    """Test POST /api/v1/payments/razorpay/create-order endpoint."""
    # First place a quick commerce order
    order_in = QuickCommerceOrderCreate(
        items=[OrderItemRequest(product_id="prod_1", quantity=2)],
        delivery_address="123 Street",
        customer_phone="+919876543210",
        payment_method=PaymentMethod.CASH,
    )
    # Mock product lookup in crud or create dummy order directly
    order = Order(
        order_id="ORD-TEST-101",
        customer_id=str(test_user.id),
        order_type=OrderType.PRODUCT_ORDER,
        total_amount=500.0,
        payment_status=PaymentStatus.PENDING,
    )
    await order.save()

    with patch("app.services.razorpay_service.razorpay_service.create_order") as mock_create_order:
        mock_create_order.return_value = {
            "id": "order_rzp_mock_123",
            "entity": "order",
            "amount": 50000,
            "amount_paid": 0,
            "amount_due": 50000,
            "currency": "INR",
            "receipt": order.order_id,
            "status": "created",
        }

        res = await client.post(
            "/api/v1/payments/razorpay/create-order",
            json={"order_id": order.order_id},
            headers=normal_user_token_headers,
        )

        assert res.status_code == 201
        data = res.json()
        assert data["success"] is True
        assert data["data"]["razorpay_order_id"] == "order_rzp_mock_123"
        assert data["data"]["amount"] == 500.0
        assert data["data"]["amount_in_paise"] == 50000
        assert data["data"]["key_id"] == settings.RAZORPAY_KEY_ID

        # Verify DB order document was updated with razorpay_order_id
        updated_order = await Order.find_one(Order.order_id == order.order_id)
        assert updated_order.razorpay_order_id == "order_rzp_mock_123"
        assert updated_order.payment_method == PaymentMethod.RAZORPAY


@pytest.mark.asyncio
async def test_verify_razorpay_payment_api(client: AsyncClient, test_user, normal_user_token_headers):
    """Test POST /api/v1/payments/razorpay/verify endpoint with valid signature."""
    settings.RAZORPAY_KEY_SECRET = "xa9Hb62CQd3EbTIeX3RXwopA"
    razorpay_service.key_secret = "xa9Hb62CQd3EbTIeX3RXwopA"

    order = Order(
        order_id="ORD-TEST-102",
        customer_id=str(test_user.id),
        order_type=OrderType.PRODUCT_ORDER,
        total_amount=250.0,
        payment_status=PaymentStatus.PENDING,
        razorpay_order_id="order_rzp_102",
    )
    await order.save()

    rzp_order_id = "order_rzp_102"
    rzp_payment_id = "pay_test_999"
    msg = f"{rzp_order_id}|{rzp_payment_id}"
    signature = hmac.new(
        "xa9Hb62CQd3EbTIeX3RXwopA".encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    payload = {
        "order_id": order.order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": rzp_payment_id,
        "razorpay_signature": signature,
    }

    res = await client.post(
        "/api/v1/payments/razorpay/verify",
        json=payload,
        headers=normal_user_token_headers,
    )

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["success"] is True
    assert data["data"]["razorpay_payment_id"] == rzp_payment_id

    # Verify order state updated in DB
    updated_order = await Order.find_one(Order.order_id == order.order_id)
    assert updated_order.payment_status == PaymentStatus.PAID
    assert updated_order.payment_method == PaymentMethod.RAZORPAY
    assert updated_order.razorpay_payment_id == rzp_payment_id


@pytest.mark.asyncio
async def test_verify_razorpay_payment_invalid_signature(client: AsyncClient, test_user, normal_user_token_headers):
    """Test POST /api/v1/payments/razorpay/verify endpoint with invalid signature."""
    order = Order(
        order_id="ORD-TEST-103",
        customer_id=str(test_user.id),
        order_type=OrderType.PRODUCT_ORDER,
        total_amount=150.0,
        payment_status=PaymentStatus.PENDING,
        razorpay_order_id="order_rzp_103",
    )
    await order.save()

    payload = {
        "order_id": order.order_id,
        "razorpay_order_id": "order_rzp_103",
        "razorpay_payment_id": "pay_fake_000",
        "razorpay_signature": "invalid_sig_12345",
    }

    res = await client.post(
        "/api/v1/payments/razorpay/verify",
        json=payload,
        headers=normal_user_token_headers,
    )

    assert res.status_code == 400
    error_msg = res.json().get("error", {}).get("message", "") or res.json().get("detail", "")
    assert "Invalid payment signature" in error_msg


    # Verify order state remains PENDING
    updated_order = await Order.find_one(Order.order_id == order.order_id)
    assert updated_order.payment_status == PaymentStatus.PENDING


@pytest.mark.asyncio
async def test_razorpay_webhook_event(client: AsyncClient, test_user):
    """Test POST /api/v1/payments/razorpay/webhook endpoint."""
    order = Order(
        order_id="ORD-TEST-104",
        customer_id=str(test_user.id),
        order_type=OrderType.PRODUCT_ORDER,
        total_amount=300.0,
        payment_status=PaymentStatus.PENDING,
        razorpay_order_id="order_rzp_104",
    )
    await order.save()

    webhook_payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_webhook_888",
                    "order_id": "order_rzp_104",
                    "amount": 30000,
                    "status": "captured",
                }
            }
        },
    }

    res = await client.post(
        "/api/v1/payments/razorpay/webhook",
        json=webhook_payload,
    )

    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    # Verify DB order status updated by webhook
    updated_order = await Order.find_one(Order.order_id == order.order_id)
    assert updated_order.payment_status == PaymentStatus.PAID
    assert updated_order.razorpay_payment_id == "pay_webhook_888"
