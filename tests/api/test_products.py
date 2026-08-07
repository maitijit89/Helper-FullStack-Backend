import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_product_crud_flow(client: AsyncClient, admin_token_headers: dict):
    # Step 1: Admin creates a product (Snacks - Kurkure)
    create_payload = {
        "name": "Kurkure Masala Munch",
        "category": "snacks",
        "description": "Crunchy spicy snack",
        "price": 20.0,
        "unit": "pack",
        "stock_quantity": 50,
        "is_available": True,
    }
    create_res = await client.post(
        "/api/v1/products/", json=create_payload, headers=admin_token_headers
    )
    assert create_res.status_code == 201
    create_data = create_res.json()
    assert create_data["success"] is True
    product_id = create_data["data"]["id"]
    assert create_data["data"]["name"] == "Kurkure Masala Munch"

    # Step 2: Public lists products
    list_res = await client.get("/api/v1/products/?category=snacks")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["success"] is True
    assert len(list_data["data"]) >= 1

    # Step 3: Admin updates product price
    update_res = await client.put(
        f"/api/v1/products/{product_id}",
        json={"price": 22.0},
        headers=admin_token_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["data"]["price"] == 22.0

    # Step 4: Admin deletes product
    del_res = await client.delete(
        f"/api/v1/products/{product_id}", headers=admin_token_headers
    )
    assert del_res.status_code == 200
    assert del_res.json()["data"]["status"] == "deleted"
