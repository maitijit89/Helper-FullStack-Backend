import pytest
from httpx import AsyncClient
from app.models.support_ticket import SupportTicket, SupportTicketStatus


@pytest.mark.asyncio
async def test_create_and_view_support_ticket(client: AsyncClient):
    """Test customer submitting a support report ticket and checking its status."""
    payload = {
        "name": "Priya Verma",
        "email": "priya.verma@example.com",
        "phone": "+919876543219",
        "subject": "Delay in delivery",
        "details": "My order #ORD-123456 has not been delivered yet.",
    }

    # 1. Create ticket
    create_resp = await client.post("/api/v1/support/tickets", json=payload)
    assert create_resp.status_code == 201
    create_json = create_resp.json()
    assert create_json["success"] is True
    ticket_data = create_json["data"]
    assert ticket_data["status"] == "pending"
    ticket_id = ticket_data["ticket_id"]

    # 2. View ticket status (showing PENDING)
    get_resp = await client.get(f"/api/v1/support/tickets/{ticket_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["status"] == "pending"


@pytest.mark.asyncio
async def test_admin_resolve_support_ticket(client: AsyncClient, admin_token_headers: dict):
    """Test Admin listing customer support tickets and marking a ticket as SOLVED."""
    payload = {
        "name": "Rahul Singh",
        "email": "rahul.singh@example.com",
        "phone": "+919876543220",
        "subject": "App glitch during payment",
        "details": "Payment was deducted but order status failed.",
    }

    # 1. Submit ticket
    create_resp = await client.post("/api/v1/support/tickets", json=payload)
    assert create_resp.status_code == 201
    ticket_id = create_resp.json()["data"]["ticket_id"]

    # 2. Admin lists pending tickets
    admin_list_resp = await client.get(
        "/api/v1/support/admin/tickets?status_filter=pending",
        headers=admin_token_headers,
    )
    assert admin_list_resp.status_code == 200
    pending_tickets = admin_list_resp.json()["data"]
    assert any(t["ticket_id"] == ticket_id for t in pending_tickets)

    # 3. Admin marks ticket as SOLVED
    solve_payload = {"admin_notes": "Refund processed successfully and status updated."}
    solve_resp = await client.patch(
        f"/api/v1/support/admin/tickets/{ticket_id}/solve",
        json=solve_payload,
        headers=admin_token_headers,
    )
    assert solve_resp.status_code == 200
    solve_json = solve_resp.json()
    assert solve_json["success"] is True
    assert solve_json["data"]["status"] == "solved"
    assert solve_json["data"]["admin_notes"] == "Refund processed successfully and status updated."

    # 4. Customer views ticket again (now SOLVED)
    get_resp = await client.get(f"/api/v1/support/tickets/{ticket_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["status"] == "solved"
