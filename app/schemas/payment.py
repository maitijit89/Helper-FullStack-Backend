from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class RazorpayOrderCreateRequest(BaseModel):
    """Payload to initiate a Razorpay payment for a system order."""

    order_id: str = Field(..., description="Backend system Order ID")
    notes: Optional[Dict[str, Any]] = Field(default=None, description="Optional custom metadata for Razorpay order")


class RazorpayOrderResponse(BaseModel):
    """Response containing Razorpay order parameters required for Checkout modal."""

    razorpay_order_id: str = Field(..., description="Razorpay generated Order ID (order_...)")
    amount: float = Field(..., description="Total amount in INR (rupees)")
    amount_in_paise: int = Field(..., description="Amount in paise (rupees * 100)")
    currency: str = Field("INR", description="Currency code")
    key_id: str = Field(..., description="Razorpay Public Key ID")
    system_order_id: str = Field(..., description="Backend system Order ID")


class RazorpayVerifyRequest(BaseModel):
    """Payload submitted by frontend checkout after payment completion for HMAC signature verification."""

    order_id: str = Field(..., description="Backend system Order ID")
    razorpay_order_id: str = Field(..., description="Razorpay Order ID")
    razorpay_payment_id: str = Field(..., description="Razorpay Payment ID (pay_...)")
    razorpay_signature: str = Field(..., description="HMAC SHA256 Signature from Razorpay")


class RazorpayVerifyResponse(BaseModel):
    """Verification result response."""

    success: bool
    order_id: str
    message: str
    razorpay_payment_id: Optional[str] = None


class RazorpayWebhookEvent(BaseModel):
    """Razorpay Webhook event payload."""

    event: str
    payload: Dict[str, Any]
