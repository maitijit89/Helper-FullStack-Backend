import pytest
from httpx import AsyncClient
from app.crud.crud_product import product_crud
from app.crud.crud_user import user_crud
from app.models.user import User
from app.schemas.location import LocationUpdate
from app.schemas.partner import DeliveryMode, PartnerCreate, PartnerVerificationStatus

from app.schemas.product import ProductCreate
from app.schemas.role import UserRole
from app.services.geo_service import calculate_haversine_distance


@pytest.mark.asyncio
async def test_haversine_distance_calculation():
    # Customer at Mumbai CST (18.9400, 72.8350)
    # Partner at Churchgate (~1.2 km away: 18.9320, 72.8260)
    dist = calculate_haversine_distance(18.9400, 72.8350, 18.9320, 72.8260)
    assert 1.0 < dist < 1.5

    # Customer and Partner at same spot
    dist_same = calculate_haversine_distance(18.9400, 72.8350, 18.9400, 72.8350)
    assert dist_same == 0.0


@pytest.mark.asyncio
async def test_cart_crud_and_min_price_rejection(
    client: AsyncClient, test_user, normal_user_token_headers
):
    # 1. Create product cheap (RS. 4.0) and expensive product (RS. 15.0)
    p_cheap = await product_crud.create(
        obj_in=ProductCreate(
            name="Small Biscuit Packet",
            category="snacks",
            price=4.0,
            stock_quantity=100,
        )
    )
    p_expensive = await product_crud.create(
        obj_in=ProductCreate(
            name="Cold Coffee Bottle",
            category="beverages",
            price=25.0,
            stock_quantity=50,
        )

    )

    # 2. Add 1 cheap item (Total = RS. 4.0) to bucket/cart
    res = await client.post(
        "/api/v1/cart/items",
        json={"product_id": str(p_cheap.id), "quantity": 1},
        headers=normal_user_token_headers,
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["items_total"] == 4.0
    assert data["is_eligible_for_checkout"] is False

    # 3. Attempt checkout below RS. 10.0 -> Should fail with 400 Bad Request
    checkout_res = await client.post(
        "/api/v1/cart/checkout",
        json={
            "payment_method": "cash",
            "delivery_address": "123 Street",
            "customer_phone": "+919876543210",
        },
        headers=normal_user_token_headers,
    )
    assert checkout_res.status_code == 400
    err_msg = checkout_res.json()["error"]["message"]
    assert "Minimum order price must be RS. 10" in err_msg



    # 4. Add expensive product to bucket -> Total = 4.0 + 25.0 = RS. 29.0
    add_res = await client.post(
        "/api/v1/cart/items",
        json={"product_id": str(p_expensive.id), "quantity": 1},
        headers=normal_user_token_headers,
    )
    assert add_res.status_code == 200
    data = add_res.json()["data"]
    assert data["items_total"] == 29.0
    assert data["is_eligible_for_checkout"] is True


@pytest.mark.asyncio
async def test_cart_checkout_upi_and_cash_payment_methods(
    client: AsyncClient, test_user, normal_user_token_headers
):
    product = await product_crud.create(
        obj_in=ProductCreate(
            name="Stationery Notebook",
            category="stationery",
            price=50.0,
            stock_quantity=10,
        )
    )

    # Add to cart
    await client.post(
        "/api/v1/cart/items",
        json={"product_id": str(product.id), "quantity": 1},
        headers=normal_user_token_headers,
    )

    # Checkout with UPI
    upi_res = await client.post(
        "/api/v1/cart/checkout",
        json={
            "payment_method": "upi",
            "upi_transaction_id": "UPI1234567890",
            "delivery_address": "Flat 101, Star Heights",
            "customer_phone": "+919876543210",
        },
        headers=normal_user_token_headers,
    )
    assert upi_res.status_code == 201
    order_data = upi_res.json()["data"]
    assert order_data["payment_method"] == "upi"
    assert order_data["payment_status"] == "paid"
    assert order_data["upi_transaction_id"] == "UPI1234567890"

    # Cart should now be empty after checkout
    get_cart_res = await client.get("/api/v1/cart", headers=normal_user_token_headers)
    assert len(get_cart_res.json()["data"]["items"]) == 0


@pytest.mark.asyncio
async def test_1km_partner_ringing_and_first_accept_algorithm(
    client: AsyncClient, test_user, normal_user_token_headers
):
    # 1. Setup Partner 1 (Within 0.4 KM radius of customer)
    p1 = await user_crud.create_partner_application(
        obj_in=PartnerCreate(
            name="Nearby Driver",
            dob="1998-05-10",
            email="nearby_partner@example.com",
            phone="+919876543211",
            college="Tech Institute",
            current_address="Campus Hostel 1",
            permanent_address="City Center",
            delivery_mode=DeliveryMode.CYCLE,
        )
    )
    p1, _, _ = await user_crud.approve_partner(db_obj=p1)
    await user_crud.update_user_location(
        db_obj=p1,
        location_in=LocationUpdate(
            latitude=19.0760, longitude=72.8777, is_gps_enabled=True, address="0.4 KM away"
        ),
    )
    await user_crud.toggle_partner_online(db_obj=p1, is_online=True)

    # 2. Setup Partner 2 (Far away - 5.0 KM radius)
    p2 = await user_crud.create_partner_application(
        obj_in=PartnerCreate(
            name="Far Driver",
            dob="1997-08-20",
            email="far_partner@example.com",
            phone="+919876543212",
            college="Engineering College",
            current_address="Outskirts Hostel",
            permanent_address="Suburban Heights",
            delivery_mode=DeliveryMode.CYCLE,
        )
    )
    p2, _, _ = await user_crud.approve_partner(db_obj=p2)
    await user_crud.update_user_location(
        db_obj=p2,
        location_in=LocationUpdate(
            latitude=19.1200, longitude=72.9300, is_gps_enabled=True, address="5 KM away"
        ),
    )
    await user_crud.toggle_partner_online(db_obj=p2, is_online=True)



    # 3. Create product & place cart order at Customer Location (19.0740, 72.8750)
    prod = await product_crud.create(
        obj_in=ProductCreate(name="Dark Fantasy", category="snacks", price=30.0, stock_quantity=10)
    )
    await client.post(
        "/api/v1/cart/items",
        json={"product_id": str(prod.id), "quantity": 1},
        headers=normal_user_token_headers,
    )

    checkout_res = await client.post(
        "/api/v1/cart/checkout",
        json={
            "payment_method": "cash",
            "delivery_address": "Customer Home",
            "delivery_location": {
                "latitude": 19.0740,
                "longitude": 72.8750,
                "is_gps_enabled": True,
            },
            "customer_phone": "+919876543210",
        },
        headers=normal_user_token_headers,
    )
    assert checkout_res.status_code == 201
    order_data = checkout_res.json()["data"]
    order_id = order_data["order_id"]

    # Notified partners should only include Partner 1 (within 1 KM)
    assert str(p1.id) in order_data["notified_partner_ids"]
    assert str(p2.id) not in order_data["notified_partner_ids"]

    # 4. First partner (p1) accepts the order
    from app.core.security import create_access_token
    token1 = create_access_token(subject=str(p1.id), role=UserRole.PARTNER)
    headers1 = {"Authorization": f"Bearer {token1}"}

    accept1_res = await client.patch(f"/api/v1/orders/{order_id}/accept", headers=headers1)
    assert accept1_res.status_code == 200
    assert accept1_res.json()["data"]["partner_id"] == str(p1.id)
    assert accept1_res.json()["data"]["status"] == "accepted"

    # 5. Second partner (p2 or p3) tries to accept the already accepted order -> Rejection
    token2 = create_access_token(subject=str(p2.id), role=UserRole.PARTNER)
    headers2 = {"Authorization": f"Bearer {token2}"}

    accept2_res = await client.patch(f"/api/v1/orders/{order_id}/accept", headers=headers2)
    assert accept2_res.status_code == 400
    err_msg2 = accept2_res.json()["error"]["message"]
    assert "already been accepted" in err_msg2


