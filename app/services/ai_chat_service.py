import logging
from typing import List, Optional
import httpx
from app.core.config import settings
from app.schemas.ai_chat import AIChatRequest, AIChatResponseData, ChatMessage

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the official AI Support Assistant for the Helper Platform.
Your purpose is to assist customers, delivery partners, and admins with platform features, order placement, document printing, assignment writing, delivery partner onboarding, and technical questions.

Key Platform Knowledge:
1. **Printing Services**:
   - Automated PDF page counting engine calculates total pages, color vs B&W pages, and binding options.
   - Binding Options: 'Paper' (standard stapled), 'Channel File', and 'Spiral File'.
2. **Assignment Writing Services**:
   - Customers can specify subject, page count, upload guidelines/documents, and select file binding preferences ('paper', 'channel_file', 'spiral_file').
   - Pick-up and delivery modes are supported (including Porter service and walking/cycle delivery).
3. **Delivery Partner Onboarding**:
   - Partners apply via `/api/v1/auth/signup/partner` providing Name, DOB, Email, Phone, College, Addresses, and Delivery Mode ('cycle' or 'walking').
   - Rate limit: 7-day cooldown between applications for the same email/phone.
   - Admin approval generates a unique Partner ID (e.g. `PRT-892134`) and password.
4. **Admin Portal**:
   - Admin access is restricted to designated email `helpingservicesteam@gmail.com` via OTP authentication.
5. **Customer Accounts & OTP**:
   - Customers sign up and log in passwordless via 6-digit email OTPs.

Guidelines:
- Be extremely polite, concise, helpful, and professional.
- Answer user questions accurately based on platform capabilities.
- Provide actionable next steps or suggestions when helpful.
"""


class AIChatService:
    @property
    def api_key(self) -> str:
        return settings.GEMINI_API_KEY

    @property
    def model(self) -> str:
        model_name = settings.GEMINI_MODEL or "gemini-1.5-flash"
        if model_name.endswith("-latest"):
            model_name = model_name[:-7]
        return model_name

    async def generate_response(self, request_data: AIChatRequest) -> AIChatResponseData:
        """Call Gemini API REST endpoint to generate assistant response."""
        if not self.api_key or "your-gemini-api-key" in self.api_key:
            logger.warning("Gemini API Key missing or default. Returning smart fallback response.")
            return self._get_fallback_response(request_data)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        # Construct contents array for Gemini REST payload
        contents = []
        
        # System instruction context
        system_context = SYSTEM_PROMPT
        if request_data.context:
            system_context += f"\nUser Current Context: {request_data.context}"

        # Add history
        for msg in request_data.chat_history or []:
            role = "user" if msg.role == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg.content}]})

        # Add prompt text with system instruction embedded
        full_user_prompt = f"[System Context: {system_context}]\n\nUser Question: {request_data.message}"
        contents.append({"role": "user", "parts": [{"text": full_user_prompt}]})

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 800,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        reply_text = "".join(part.get("text", "") for part in parts)
                        if reply_text.strip():
                            suggested_actions = self._generate_suggested_actions(request_data.context, reply_text)
                            return AIChatResponseData(
                                reply=reply_text.strip(),
                                suggested_actions=suggested_actions,
                                model_used=self.model,
                            )
                
                logger.error("Gemini API error (status %s): %s", response.status_code, response.text)
                return self._get_fallback_response(request_data)

        except Exception as e:
            logger.error("Error communicating with Gemini API: %s", e)
            return self._get_fallback_response(request_data)

    def _generate_suggested_actions(self, context: Optional[str], reply: str) -> List[str]:
        """Generate smart quick-action chips for the user."""
        context_lower = (context or "").lower()
        if "print" in context_lower:
            return ["Upload PDF Document", "Calculate Page Count", "Select Spiral Binding"]
        elif "assignment" in context_lower:
            return ["Create Assignment Order", "Select Channel File", "Check Page Pricing"]
        elif "partner" in context_lower:
            return ["Apply as Delivery Partner", "Check Application Status", "Partner Login"]
        elif "admin" in context_lower:
            return ["Admin OTP Login", "Pending Applications", "Manage Orders"]
        return ["Track My Order", "Print Service", "Assignment Help", "Contact Support"]

    def _get_fallback_response(self, request_data: AIChatRequest) -> AIChatResponseData:
        """Provide helpful fallback response if Gemini API is unreachable or key is unconfigured."""
        msg = request_data.message.lower()
        if "print" in msg or "pdf" in msg:
            reply = "Welcome to Helper Print Services! You can upload your PDF document, calculate exact page counts, and choose between Paper, Channel File, or Spiral File binding options."
        elif "assignment" in msg:
            reply = "You can order assignment writing services directly! Specify your subject, required page count, binding choice, and upload instructions."
        elif "partner" in msg or "driver" in msg:
            reply = "Interested in becoming a delivery partner? Fill out the partner application form with your college details and preferred delivery mode (Walking or Cycle)."
        else:
            reply = f"Hello! How can I assist you today with Helper platform services? You asked: '{request_data.message}'."

        return AIChatResponseData(
            reply=reply,
            suggested_actions=self._generate_suggested_actions(request_data.context, reply),
            model_used="helper-ai-fallback",
        )


ai_chat_service = AIChatService()
