from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class PayoutMethod(str, Enum):
    UPI = "upi"
    BANK_TRANSFER = "bank_transfer"


class WithdrawalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class WithdrawalRequest(Document):
    """MongoDB Document model for Partner Withdrawal / Payout Requests."""

    request_id: Indexed(str, unique=True)
    partner_id: Indexed(str)
    partner_name: str
    amount: float = Field(..., ge=1.0, description="Withdrawal amount in INR")
    payout_method: PayoutMethod
    upi_id: Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_holder_name: Optional[str] = None
    status: WithdrawalStatus = WithdrawalStatus.PENDING
    admin_notes: Optional[str] = None
    transaction_reference: Optional[str] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "withdrawal_requests"
        indexes = [
            "request_id",
            "partner_id",
            "status",
            [("status", 1), ("created_at", -1)],
        ]

    def touch(self):
        self.updated_at = datetime.now(timezone.utc)
