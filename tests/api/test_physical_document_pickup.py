import pytest
from httpx import AsyncClient
from app.core.security import create_access_token
from app.crud.crud_user import user_crud
from app.schemas.partner import DeliveryMode, PartnerCreate
from app.schemas.role import UserRole


@pytest.mark.asyncio
async def test_physical_document_pickup_xerox_order_workflow(
    client: AsyncClient, test_user, normal_user_token_headers
):
    # 1. Partner registration & approval
    partner_app = await user_crud.create_partner_application(
        obj_in=PartnerCreate(
            name="Physical Hardcopy Driver",
            dob="1994-04-04",
            email="hardcopydriver@example.com",
            phone="+919876543999",
            college="State Tech",
            current_address="Station Road",
            permanent_address="Station Road",
            delivery_mode=DeliveryMode.CYCLE,
        )
    )
    partner, partner_id, initial_password = await user_crud.approve_partner(db_obj=partner_app)

    # 2. Customer places physical hardcopy Xerox pickup order (without digital file upload)
    confirm_res = await client.post(
        "/api/v1/print/confirm-order",
        json={
            "document_name": "My Physical Textbook & Notebooks",
            "is_physical_pickup": True,
            "confirmed_num_pages": 50,
            "num_copies": 2,
            "color_mode": "black_and_white",
            "paper_size": "A4",
            "is_double_sided": True,
            "binding_type": "spiral",
            "delivery_address": "Hostel 4 Room 204",
            "delivery_location": {
                "latitude": 19.0740,
                "longitude": 72.8750,
                "is_gps_enabled": True,
            },
            "customer_phone": "+919876543210",
            "payment_method": "cash",
            "special_instructions": "Please pick up physical textbook from room 204",
        },
        headers=normal_user_token_headers,
    )
    assert confirm_res.status_code == 201
    order_id = confirm_res.json()["data"]["order_id"]
    assert confirm_res.json()["data"]["print_spec"]["is_physical_pickup"] is True

    # 3. Partner updates location (GPS ON) and accepts order
    partner_token = create_access_token(subject=str(partner.id), role=UserRole.PARTNER)
    partner_headers = {"Authorization": f"Bearer {partner_token}"}

    await client.put(
        "/api/v1/partner/location",
        json={
            "latitude": 19.0750,
            "longitude": 72.8760,
            "is_gps_enabled": True,
            "address": "Partner Shop Location",
        },
        headers=partner_headers,
    )

    accept_res = await client.patch(f"/api/v1/orders/{order_id}/accept", headers=partner_headers)
    assert accept_res.status_code == 200
    assert accept_res.json()["data"]["status"] == "accepted"

    # 4. Partner travels to customer & confirms physical document pickup
    pickup_res = await client.patch(f"/api/v1/orders/{order_id}/pickup-document", headers=partner_headers)
    assert pickup_res.status_code == 200
    assert pickup_res.json()["data"]["status"] == "document_picked_up"

    # 5. Partner finishes photocopying & marks status out_for_delivery
    out_res = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "out_for_delivery"},
        headers=partner_headers,
    )
    assert out_res.status_code == 200
    assert out_res.json()["data"]["status"] == "out_for_delivery"

    # 6. Partner returns original hardcopy + new Xerox copies to customer
    del_res = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "delivered"},
        headers=partner_headers,
    )
    assert del_res.status_code == 200
    assert del_res.json()["data"]["status"] == "delivered"
