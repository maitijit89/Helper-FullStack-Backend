import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_quick_commerce_order_flow(
    client: AsyncClient, normal_user_token_headers: dict, admin_token_headers: dict
):
    # Step 1: Admin creates a Cold Drink product
    prod_payload = {
        "name": "Coca Cola 750ml",
        "category": "beverages",
        "description": "Chilled Cold Drink",
        "price": 40.0,
        "unit": "bottle",
        "stock_quantity": 100,
        "is_available": True,
    }
    prod_res = await client.post(
        "/api/v1/products/", json=prod_payload, headers=admin_token_headers
    )
    product_id = prod_res.json()["data"]["id"]

    # Step 2: Customer places Quick Commerce order
    order_payload = {
        "items": [{"product_id": product_id, "quantity": 2}],
        "delivery_address": "Hostel Block A, Room 102",
        "customer_phone": "+919876543210",
    }
    order_res = await client.post(
        "/api/v1/orders/quick-commerce",
        json=order_payload,
        headers=normal_user_token_headers,
    )
    assert order_res.status_code == 201
    order_data = order_res.json()
    assert order_data["success"] is True
    assert order_data["data"]["order_type"] == "product_order"
    assert order_data["data"]["items_total"] == 80.0
    assert order_data["data"]["total_amount"] == 105.0  # 80 + 25 delivery fee


@pytest.mark.asyncio
async def test_print_service_order_flow(
    client: AsyncClient, normal_user_token_headers: dict
):
    # Place Xerox / Document Printing order with Spiral Binding
    print_payload = {
        "file_url": "https://storage.example.com/docs/assignment.pdf",
        "document_name": "Physics Lab Manual",
        "num_pages": 15,
        "num_copies": 2,
        "color_mode": "black_and_white",
        "paper_size": "A4",
        "is_double_sided": True,
        "binding_type": "spiral",
        "delivery_address": "Library Reading Hall, Desk 5",
        "customer_phone": "+919876543210",
        "special_instructions": "Please print clearly on 75 GSM paper",
    }
    res = await client.post(
        "/api/v1/orders/print-service",
        json=print_payload,
        headers=normal_user_token_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["success"] is True
    assert data["data"]["order_type"] == "print_service"
    assert data["data"]["print_spec"]["binding_type"] == "spiral"


@pytest.mark.asyncio
async def test_porter_service_order_flow(
    client: AsyncClient, normal_user_token_headers: dict
):
    # Place Porter Parcel Delivery order under 5kg
    porter_payload = {
        "item_description": "Documents & Laptop Charger",
        "weight_kg": 2.5,
        "pickup_address": "Gate 1, Main Campus",
        "drop_address": "Hostel 3, Room 204",
        "sender_phone": "+919876543210",
        "receiver_phone": "+919123456789",
        "notes": "Handle with care",
    }
    res = await client.post(
        "/api/v1/orders/porter-service",
        json=porter_payload,
        headers=normal_user_token_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["success"] is True
    assert data["data"]["order_type"] == "porter_service"
    assert data["data"]["porter_spec"]["weight_kg"] == 2.5


@pytest.mark.asyncio
async def test_porter_service_overweight_rejection(
    client: AsyncClient, normal_user_token_headers: dict
):
    # Attempting to request Porter delivery for 6kg -> Expect 422 Unprocessable Content error
    porter_payload = {
        "item_description": "Heavy Machinery",
        "weight_kg": 6.0,
        "pickup_address": "Point A",
        "drop_address": "Point B",
        "sender_phone": "+919876543210",
        "receiver_phone": "+919123456789",
    }
    res = await client.post(
        "/api/v1/orders/porter-service",
        json=porter_payload,
        headers=normal_user_token_headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_partner_my_deliveries_endpoint(
    client: AsyncClient, partner_user, partner_token_headers: dict
):
    from app.models.order import Order, OrderType, OrderStatus
    order = Order(
        order_id="ORD-PRT-001",
        customer_id="cust_123",
        partner_id=str(partner_user.id),
        order_type=OrderType.PRODUCT_ORDER,
        status=OrderStatus.ACCEPTED,
        total_amount=150.0,
    )
    await order.save()

    res = await client.get(
        "/api/v1/orders/partner/my-deliveries",
        headers=partner_token_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert len(data["data"]) >= 1
    assert data["data"][0]["order_id"] == "ORD-PRT-001"


@pytest.mark.asyncio
async def test_customer_cancel_order_and_authorization(
    client: AsyncClient, test_user, normal_user_token_headers: dict, partner_token_headers: dict
):
    from app.models.order import Order, OrderType, OrderStatus
    order = Order(
        order_id="ORD-CANCEL-001",
        customer_id=str(test_user.id),
        order_type=OrderType.PRODUCT_ORDER,
        status=OrderStatus.PENDING,
        total_amount=200.0,
    )
    await order.save()

    # Partner attempts to update status on unassigned order -> Forbidden 403
    unauth_res = await client.patch(
        f"/api/v1/orders/{order.order_id}/status",
        json={"status": "delivered"},
        headers=partner_token_headers,
    )
    assert unauth_res.status_code == 403

    # Customer cancels their pending order -> Success 200
    cancel_res = await client.patch(
        f"/api/v1/orders/{order.order_id}/cancel",
        headers=normal_user_token_headers,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["data"]["status"] == "cancelled"

