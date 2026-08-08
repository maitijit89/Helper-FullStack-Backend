import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ai_chat_endpoint(client: AsyncClient):
    """Test POST /api/v1/ai/chat endpoint returns valid AI assistance response."""
    payload = {
        "message": "How do I calculate page count for PDF printing?",
        "context": "print_service",
        "chat_history": [
            {"role": "user", "content": "Hi"},
            {"role": "assistant", "content": "Hello! How can I help you?"}
        ]
    }
    response = await client.post("/api/v1/ai/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "reply" in data["data"]
    assert "suggested_actions" in data["data"]
    assert "model_used" in data["data"]
