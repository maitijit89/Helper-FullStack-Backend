import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_admin_dashboard_overview(client: AsyncClient, admin_token_headers: dict):
    overview_resp = await client.get("/api/v1/admin/dashboard/overview", headers=admin_token_headers)
    assert overview_resp.status_code == 200, f"Response: {overview_resp.text}"
    overview_json = overview_resp.json()
    assert overview_json.get("success") is True
    assert "data" in overview_json
    assert "overview_summary" in overview_json["data"]





@pytest.mark.asyncio
async def test_admin_dashboard_locations(client: AsyncClient, admin_token_headers: dict):
    loc_resp = await client.get("/api/v1/admin/dashboard/locations", headers=admin_token_headers)
    assert loc_resp.status_code == 200, f"Response: {loc_resp.text}"
    loc_json = loc_resp.json()
    assert loc_json["success"] is True
    assert isinstance(loc_json["data"], list)


@pytest.mark.asyncio
async def test_admin_dashboard_realtime_orders(client: AsyncClient, admin_token_headers: dict):
    orders_resp = await client.get("/api/v1/admin/dashboard/realtime-orders", headers=admin_token_headers)
    assert orders_resp.status_code == 200, f"Response: {orders_resp.text}"
    orders_json = orders_resp.json()
    assert orders_json["success"] is True
    assert "total_active_orders" in orders_json["data"]


@pytest.mark.asyncio
async def test_admin_dashboard_users_graph(client: AsyncClient, admin_token_headers: dict):
    users_graph_resp = await client.get("/api/v1/admin/dashboard/analytics/users-graph", headers=admin_token_headers)
    assert users_graph_resp.status_code == 200, f"Response: {users_graph_resp.text}"
    users_json = users_graph_resp.json()
    assert users_json["success"] is True
    assert "time_series" in users_json["data"]


@pytest.mark.asyncio
async def test_admin_dashboard_traffic_graph(client: AsyncClient, admin_token_headers: dict):
    traffic_resp = await client.get("/api/v1/admin/dashboard/analytics/traffic-graph", headers=admin_token_headers)
    assert traffic_resp.status_code == 200, f"Response: {traffic_resp.text}"
    traffic_json = traffic_resp.json()
    assert traffic_json["success"] is True
    assert "time_series" in traffic_json["data"]


@pytest.mark.asyncio
async def test_admin_dashboard_feature_usage(client: AsyncClient, admin_token_headers: dict):
    feature_resp = await client.get("/api/v1/admin/dashboard/analytics/feature-usage", headers=admin_token_headers)
    assert feature_resp.status_code == 200, f"Response: {feature_resp.text}"
    feature_json = feature_resp.json()
    assert feature_json["success"] is True
    assert "most_used_feature" in feature_json["data"]
    assert "breakdown" in feature_json["data"]
