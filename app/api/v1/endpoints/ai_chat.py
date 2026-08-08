from fastapi import APIRouter, status
from app.schemas.ai_chat import AIChatRequest, AIChatResponseData
from app.schemas.response import APIResponse
from app.services.ai_chat_service import ai_chat_service

router = APIRouter()


@router.post(
    "/chat",
    response_model=APIResponse[AIChatResponseData],
    status_code=status.HTTP_200_OK,
    summary="AI Support Chat Assistant",
    description="Ask the Gemini AI Assistant questions about print services, assignment writing, partner applications, or order tracking."
)
async def chat_with_ai(request: AIChatRequest):
    """Generate assistant response using Gemini API."""
    response_data = await ai_chat_service.generate_response(request)
    return APIResponse(
        success=True,
        message="AI assistant response generated successfully",
        data=response_data,
    )
