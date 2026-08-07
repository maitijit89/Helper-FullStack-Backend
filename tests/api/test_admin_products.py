import io
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_add_edit_delete_product_flow(
    client: AsyncClient, admin_token_headers: dict
):
    # Step 1: Admin adds product
    add_payload = {
        "name": "Spiral Notebook 200 Pages",
        "category": "stationery",
        "description": "Rule line notebook for students",
        "price": 60.0,
        "unit": "copy",
        "stock_quantity": 30,
        "is_available": True,
        "tags": ["notebook", "spiral"],
    }
    add_res = await client.post(
        "/api/v1/products/", json=add_payload, headers=admin_token_headers
    )
    assert add_res.status_code == 201
    product_data = add_res.json()["data"]
    product_id = product_data["id"]
    assert product_data["name"] == "Spiral Notebook 200 Pages"

    # Step 2: Admin edits product details
    edit_payload = {
        "price": 55.0,
        "stock_quantity": 50,
        "description": "Updated 200 pages spiral notebook",
    }
    edit_res = await client.put(
        f"/api/v1/products/{product_id}",
        json=edit_payload,
        headers=admin_token_headers,
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["data"]["price"] == 55.0
    assert edit_res.json()["data"]["stock_quantity"] == 50

    # Step 3: Admin uploads product image file
    fake_image = io.BytesIO(b"fake image bytes content")
    upload_files = {"image": ("notebook.png", fake_image, "image/png")}
    upload_res = await client.post(
        f"/api/v1/products/{product_id}/upload-image",
        files=upload_files,
        headers=admin_token_headers,
    )
    assert upload_res.status_code == 200
    upload_data = upload_res.json()["data"]
    assert upload_data["image_url"].startswith("/static/products/")

    # Step 4: Admin deletes product
    del_res = await client.delete(
        f"/api/v1/products/{product_id}", headers=admin_token_headers
    )
    assert del_res.status_code == 200
    assert del_res.json()["data"]["status"] == "deleted"


@pytest.mark.asyncio
async def test_admin_create_product_with_image_multipart(
    client: AsyncClient, admin_token_headers: dict
):
    fake_image = io.BytesIO(b"fake photo bytes")
    files = {"image": ("cold_drink.jpg", fake_image, "image/jpeg")}
    form_data = {
        "name": "Pran Potato Crackers",
        "category": "snacks",
        "price": "15.0",
        "description": "Crispy potato chips",
        "unit": "pack",
        "stock_quantity": "100",
        "is_available": "true",
    }

    res = await client.post(
        "/api/v1/products/with-image",
        data=form_data,
        files=files,
        headers=admin_token_headers,
    )
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["name"] == "Pran Potato Crackers"
    assert data["image_url"].startswith("/static/products/")


@pytest.mark.asyncio
async def test_non_admin_forbidden_product_management(
    client: AsyncClient, normal_user_token_headers: dict
):
    add_payload = {
        "name": "Unauthorized Item",
        "category": "snacks",
        "price": 10.0,
    }
    res = await client.post(
        "/api/v1/products/", json=add_payload, headers=normal_user_token_headers
    )
    assert res.status_code == 403
