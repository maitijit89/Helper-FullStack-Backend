from typing import List, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role of the speaker: 'user' or 'assistant'")
    content: str = Field(..., description="Message text content")


class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User's query or support message")
    context: Optional[str] = Field(
        None,
        description="Optional current page/feature context (e.g., 'order_tracking', 'print_service', 'partner_signup')"
    )
    chat_history: Optional[List[ChatMessage]] = Field(
        default=[],
        description="Previous conversation history turns"
    )


class AIChatResponseData(BaseModel):
    reply: str = Field(..., description="AI Assistant response text")
    suggested_actions: Optional[List[str]] = Field(
        default=[],
        description="Quick action suggestions for the user"
    )
    model_used: str = Field(..., description="AI model used for generation")
