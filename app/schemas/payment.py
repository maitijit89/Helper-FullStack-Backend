from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class RazorpayOrderCreateRequest(BaseModel):
    """Payload to initiate a Razorpay payment for a system order."""

    order_id: Optional[str] = Field(default=None, description="Backend system Order ID")
    system_order_id: Optional[str] = Field(default=None, description="Backend system Order ID alternative key")
    orderId: Optional[str] = Field(default=None, description="CamelCase Order ID")
    notes: Optional[Dict[str, Any]] = Field(default=None, description="Optional custom metadata for Razorpay order")

    @property
    def get_order_id(self) -> str:
        return self.order_id or self.system_order_id or self.orderId or ""


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

    order_id: Optional[str] = Field(default=None, description="Backend system Order ID")
    system_order_id: Optional[str] = Field(default=None, description="Backend system Order ID alternative key")
    orderId: Optional[str] = Field(default=None, description="CamelCase Order ID")
    razorpay_order_id: str = Field(..., description="Razorpay Order ID")
    razorpay_payment_id: str = Field(..., description="Razorpay Payment ID (pay_...)")
    razorpay_signature: str = Field(..., description="HMAC SHA256 Signature from Razorpay")

    @property
    def get_order_id(self) -> str:
        return self.order_id or self.system_order_id or self.orderId or ""


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


class RazorpayRefundRequest(BaseModel):
    """Payload to initiate a refund for an order paid via Razorpay."""

    order_id: str = Field(..., description="System Order ID to refund")
    amount: Optional[float] = Field(None, ge=1.0, description="Optional partial refund amount in rupees. If omitted, full refund is issued.")
    reason: Optional[str] = Field(None, description="Reason for refund")


class RazorpayRefundResponse(BaseModel):
    """Response returned upon refund execution."""

    success: bool
    order_id: str
    refund_id: str
    payment_id: str
    amount_refunded: float
    message: str
    currency: str = "INR"

