import pytest
from httpx import AsyncClient
from app.crud.crud_product import product_crud
from app.crud.crud_user import user_crud
from app.schemas.location import LocationUpdate
from app.schemas.partner import DeliveryMode, PartnerCreate, PartnerVerificationStatus
from app.schemas.product import ProductCreate
from app.schemas.role import UserRole


@pytest.mark.asyncio
async def test_partner_auto_online_post_login(client: AsyncClient):
    # Setup Partner
    partner = await user_crud.create_partner_application(
        obj_in=PartnerCreate(
            name="Login Driver",
            dob="1999-01-01",
            email="logindriver@example.com",
            phone="+919876500001",
            college="State University",
            current_address="Hostel 2",
            permanent_address="City",
            delivery_mode=DeliveryMode.CYCLE,
        )
    )
    partner, partner_id, initial_password = await user_crud.approve_partner(db_obj=partner)

    # Login partner
    login_res = await client.post(
        "/api/v1/auth/partner/login",
        json={"partner_id_or_email": partner.email, "password": initial_password},
    )
    assert login_res.status_code == 200

    # Fetch partner profile -> check is_online is True
    updated_partner = await user_crud.get_by_id(str(partner.id))
    assert updated_partner.partner_profile.is_online is True


@pytest.mark.asyncio
async def test_bidirectional_order_live_location_tracking(
    client: AsyncClient, test_user, normal_user_token_headers
):
    # 1. Setup approved partner
    partner = await user_crud.create_partner_application(
        obj_in=PartnerCreate(
            name="Tracking Driver",
            dob="1997-03-15",
            email="trackingdriver@example.com",
            phone="+919876500002",
            college="Tech Institute",
            current_address="Hostel A",
            permanent_address="Main Road",
            delivery_mode=DeliveryMode.CYCLE,
        )
    )
    partner, partner_id, initial_password = await user_crud.approve_partner(db_obj=partner)

    # Set initial partner location (Mumbai: 19.0760, 72.8777)
    await user_crud.update_user_location(
        db_obj=partner,
        location_in=LocationUpdate(
            latitude=19.0760, longitude=72.8777, is_gps_enabled=True, address="Partner Base"
        ),
    )

    # 2. Customer places an order
    product = await product_crud.create(
        obj_in=ProductCreate(name="Notebook", category="stationery", price=40.0, stock_quantity=10)
    )
    await client.post(
        "/api/v1/cart/items",
        json={"product_id": str(product.id), "quantity": 1},
        headers=normal_user_token_headers,
    )

    checkout_res = await client.post(
        "/api/v1/cart/checkout",
        json={
            "payment_method": "upi",
            "upi_transaction_id": "UPI999",
            "delivery_address": "Customer Apartment",
            "delivery_location": {
                "latitude": 19.0740,
                "longitude": 72.8750,
                "is_gps_enabled": True,
                "address": "Customer Apartment",
            },
            "customer_phone": "+919876543210",
        },
        headers=normal_user_token_headers,
    )
    assert checkout_res.status_code == 201
    order_id = checkout_res.json()["data"]["order_id"]

    # 3. Partner accepts order
    from app.core.security import create_access_token
    partner_token = create_access_token(subject=str(partner.id), role=UserRole.PARTNER)
    partner_headers = {"Authorization": f"Bearer {partner_token}"}

    accept_res = await client.patch(f"/api/v1/orders/{order_id}/accept", headers=partner_headers)
    assert accept_res.status_code == 200

    # 4. Customer fetches order live location
    cust_track_res = await client.get(
        f"/api/v1/orders/{order_id}/live-location", headers=normal_user_token_headers
    )
    assert cust_track_res.status_code == 200
    track_data = cust_track_res.json()["data"]
    assert track_data["partner_location"]["latitude"] == 19.0760
    assert track_data["customer_location"]["latitude"] == 19.0740
    assert track_data["distance_between_km"] is not None
    assert track_data["partner"]["name"] == "Tracking Driver"

    # 5. Partner updates live location while delivering
    loc_upd_res = await client.put(
        "/api/v1/partner/location",
        json={
            "latitude": 19.0750,
            "longitude": 72.8760,
            "is_gps_enabled": True,
            "address": "En route to customer",
        },
        headers=partner_headers,
    )
    assert loc_upd_res.status_code == 200

    # 6. Customer fetches updated live location
    cust_track_res2 = await client.get(
        f"/api/v1/orders/{order_id}/live-location", headers=normal_user_token_headers
    )
    assert cust_track_res2.status_code == 200
    updated_track = cust_track_res2.json()["data"]
    assert updated_track["partner_location"]["latitude"] == 19.0750

    # 7. Unauthorized user tries to track order -> 403 Forbidden
    from app.schemas.user import CustomerUserCreate
    from app.schemas.gender import Gender
    other_user = await user_crud.create_customer(
        obj_in=CustomerUserCreate(
            name="Other Customer",
            dob="2000-01-01",
            gender=Gender.FEMALE,
            email="otheruser@example.com",
            phone="+919876599999",
            college="College B",
            address="Address B",
            password="Password123!",
        )
    )
    other_token = create_access_token(subject=str(other_user.id), role=UserRole.USER)
    other_headers = {"Authorization": f"Bearer {other_token}"}
    forbidden_res = await client.get(
        f"/api/v1/orders/{order_id}/live-location", headers=other_headers
    )
    assert forbidden_res.status_code == 403

