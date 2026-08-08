from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class TransactionType(str, Enum):
    EARNING = "earning"
    WITHDRAWAL = "withdrawal"


class PartnerWallet(Document):
    """MongoDB Document model for Partner Earnings Wallet."""

    partner_id: Indexed(str, unique=True)
    total_balance: float = Field(0.0, ge=0.0, description="Total earned balance")
    pending_withdrawal_balance: float = Field(0.0, ge=0.0, description="Amount locked in pending withdrawal requests")
    total_withdrawn: float = Field(0.0, ge=0.0, description="Total successfully withdrawn balance")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "partner_wallets"
        indexes = [
            "partner_id",
        ]

    def touch(self):
        self.updated_at = datetime.now(timezone.utc)


class WalletTransaction(Document):
    """MongoDB Document model for Partner Wallet Earnings and Withdrawal Transactions."""

    partner_id: Indexed(str)
    order_id: Optional[str] = None
    amount: float = Field(..., ge=0.0, description="Transaction amount in INR")
    transaction_type: TransactionType
    description: str = ""
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "wallet_transactions"
        indexes = [
            "partner_id",
            "transaction_type",
            [("partner_id", 1), ("created_at", -1)],
        ]
