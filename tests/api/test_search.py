import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_search_engine_and_relevance(client: AsyncClient, admin_token_headers: dict):
    # Setup test catalog items across categories
    item1 = {
        "name": "Coca Cola 750ml",
        "category": "beverages",
        "description": "Chilled carbonated soft drink",
        "price": 40.0,
        "unit": "bottle",
        "stock_quantity": 50,
        "is_available": True,
        "tags": ["coke", "soda", "colddrink"],
    }
    item2 = {
        "name": "Kurkure Masala Munch",
        "category": "snacks",
        "description": "Spicy potato chips and crunchy snacks",
        "price": 20.0,
        "unit": "pack",
        "stock_quantity": 100,
        "is_available": True,
        "tags": ["chips", "namkeen"],
    }
    item3 = {
        "name": "A4 Xerox & Document Printing",
        "category": "printing",
        "description": "Photocopy and document print service",
        "price": 2.0,
        "unit": "page",
        "stock_quantity": 999,
        "is_available": True,
        "tags": ["xerox", "copy", "print"],
    }

    await client.post("/api/v1/products/", json=item1, headers=admin_token_headers)
    await client.post("/api/v1/products/", json=item2, headers=admin_token_headers)
    await client.post("/api/v1/products/", json=item3, headers=admin_token_headers)

    # Test 1: Search "xerox" -> Synonym match should find printing service with highest score
    res_xerox = await client.get("/api/v1/products/search?q=xerox")
    assert res_xerox.status_code == 200
    data_xerox = res_xerox.json()["data"]
    assert data_xerox["total_matches"] >= 1
    assert data_xerox["suggested_category"] == "printing"
    top_match = data_xerox["results"][0]
    assert "Xerox" in top_match["product"]["name"]
    assert top_match["relevance_score"] > 0

    # Test 2: Search "coke" -> Synonym match should find Coca Cola
    res_coke = await client.get("/api/v1/products/search?q=coke")
    assert res_coke.status_code == 200
    data_coke = res_coke.json()["data"]
    assert data_coke["suggested_category"] == "beverages"
    assert "Coca Cola" in data_coke["results"][0]["product"]["name"]

    # Test 3: Search "chips" -> Should find Kurkure
    res_chips = await client.get("/api/v1/products/search?q=chips")
    assert res_chips.status_code == 200
    assert len(res_chips.json()["data"]["results"]) >= 1

    # Test 4: Price filter & sorting
    res_sorted = await client.get("/api/v1/products/search?q=&sort_by=price_low_to_high")
    assert res_sorted.status_code == 200
    results = res_sorted.json()["data"]["results"]
    prices = [r["product"]["price"] for r in results]
    assert prices == sorted(prices)

    # Test 5: Auto-complete suggestions
    res_sugg = await client.get("/api/v1/products/suggestions?q=kur")
    assert res_sugg.status_code == 200
    sugg_data = res_sugg.json()["data"]
    assert len(sugg_data["suggestions"]) >= 1
    assert "Kurkure Masala Munch" in sugg_data["suggestions"]
