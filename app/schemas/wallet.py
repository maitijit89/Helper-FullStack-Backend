from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator
from app.models.wallet import TransactionType
from app.models.withdrawal import PayoutMethod, WithdrawalStatus


class WalletTransactionResponse(BaseModel):
    id: Optional[str] = None
    partner_id: str
    order_id: Optional[str] = None
    amount: float
    transaction_type: TransactionType
    description: str
    created_at: datetime


class PartnerWalletResponse(BaseModel):
    partner_id: str
    total_balance: float = Field(..., description="Total accumulated balance in INR")
    withdrawable_balance: float = Field(..., description="Available balance completed 48h holding period")
    pending_withdrawal_balance: float = Field(..., description="Amount locked in pending withdrawal requests")
    total_withdrawn: float = Field(..., description="Total successfully withdrawn amount")
    holding_period_hours: int = 48
    recent_transactions: List[WalletTransactionResponse] = Field(default_factory=list)


class WithdrawalCreate(BaseModel):
    amount: float = Field(..., ge=1.0, description="Withdrawal amount in INR (minimum ₹1)")
    payout_method: PayoutMethod = PayoutMethod.UPI
    upi_id: Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_holder_name: Optional[str] = None

    @model_validator(mode="after")
    def validate_payout_details(self):
        if self.payout_method == PayoutMethod.UPI:
            if not self.upi_id or not self.upi_id.strip():
                raise ValueError("UPI ID is required for UPI payout method.")
        elif self.payout_method == PayoutMethod.BANK_TRANSFER:
            if not self.bank_account_number or not self.ifsc_code or not self.account_holder_name:
                raise ValueError("Bank Account Number, IFSC Code, and Account Holder Name are required for Bank Transfer.")
        return self


class WithdrawalResponse(BaseModel):
    request_id: str
    partner_id: str
    partner_name: str
    amount: float
    payout_method: PayoutMethod
    upi_id: Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_holder_name: Optional[str] = None
    status: WithdrawalStatus
    admin_notes: Optional[str] = None
    transaction_reference: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AdminWithdrawalApproval(BaseModel):
    status: WithdrawalStatus = Field(..., description="Set to 'approved' or 'rejected'")
    admin_notes: Optional[str] = None
    transaction_reference: Optional[str] = Field(None, description="Offline bank/UPI reference number when approving")
