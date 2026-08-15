from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_admin, get_current_partner
from app.models.user import User
from app.models.withdrawal import WithdrawalRequest, WithdrawalStatus
from app.schemas.response import APIResponse
from app.schemas.wallet import (
    AdminWithdrawalApproval,
    PartnerWalletResponse,
    WithdrawalCreate,
    WithdrawalResponse,
)
from app.services.wallet_service import wallet_service

router = APIRouter()


# ==================== PARTNER WALLET ENDPOINTS ====================

@router.get("/partner/wallet", response_model=APIResponse[PartnerWalletResponse])
async def get_partner_wallet(
    current_partner: User = Depends(get_current_partner),
) -> Any:
    """Get delivery partner wallet balance, 48-hour withdrawable balance, and recent transaction history."""
    summary = await wallet_service.get_partner_wallet_summary(partner_id=str(current_partner.id))
    return APIResponse(
        success=True,
        message="Partner wallet summary fetched successfully",
        data=summary,
    )


@router.post("/partner/wallet/withdraw", response_model=APIResponse[WithdrawalResponse])
async def request_partner_withdrawal(
    obj_in: WithdrawalCreate,
    current_partner: User = Depends(get_current_partner),
) -> Any:
    """
    Submit a withdrawal request for earnings completed 48-hour holding period.
    Supports UPI ID or Bank Transfer details (Account Number, IFSC Code, Holder Name).
    """
    partner_name = current_partner.full_name or current_partner.email
    request = await wallet_service.create_withdrawal_request(
        partner_id=str(current_partner.id),
        partner_name=partner_name,
        obj_in=obj_in,
    )
    return APIResponse(
        success=True,
        message="Withdrawal request submitted successfully. Awaiting Admin manual payout approval.",
        data=WithdrawalResponse(
            request_id=request.request_id,
            partner_id=request.partner_id,
            partner_name=request.partner_name,
            amount=request.amount,
            payout_method=request.payout_method,
            upi_id=request.upi_id,
            bank_account_number=request.bank_account_number,
            ifsc_code=request.ifsc_code,
            account_holder_name=request.account_holder_name,
            status=request.status,
            admin_notes=request.admin_notes,
            transaction_reference=request.transaction_reference,
            created_at=request.created_at,
            updated_at=request.updated_at,
        ),
    )


@router.get("/partner/wallet/withdrawals", response_model=APIResponse[List[WithdrawalResponse]])
async def get_partner_withdrawals(
    current_partner: User = Depends(get_current_partner),
) -> Any:
    """List all withdrawal requests submitted by current delivery partner."""
    requests = await WithdrawalRequest.find(
        WithdrawalRequest.partner_id == str(current_partner.id)
    ).sort("-created_at").to_list()

    data = [
        WithdrawalResponse(
            request_id=r.request_id,
            partner_id=r.partner_id,
            partner_name=r.partner_name,
            amount=r.amount,
            payout_method=r.payout_method,
            upi_id=r.upi_id,
            bank_account_number=r.bank_account_number,
            ifsc_code=r.ifsc_code,
            account_holder_name=r.account_holder_name,
            status=r.status,
            admin_notes=r.admin_notes,
            transaction_reference=r.transaction_reference,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in requests
    ]
    return APIResponse(
        success=True,
        message="Partner withdrawal requests fetched successfully",
        data=data,
    )


@router.get("/partner/wallet/earnings-history", response_model=APIResponse[dict])
async def get_partner_earnings_history(
    current_partner: User = Depends(get_current_partner),
) -> Any:
    """Fetch daily earnings breakdown, 48h holding maturity status, and completed delivery stats."""
    analytics = await wallet_service.get_partner_earnings_analytics(partner_id=str(current_partner.id))
    return APIResponse(
        success=True,
        message="Partner earnings analytics retrieved successfully",
        data=analytics,
    )


# ==================== ADMIN WITHDRAWAL ENDPOINTS ====================

@router.get("/admin/withdrawals", response_model=APIResponse[List[WithdrawalResponse]])
async def get_admin_withdrawals(
    status: Optional[WithdrawalStatus] = Query(None, description="Filter by status e.g. pending, approved, rejected"),
    admin: User = Depends(get_current_admin),
) -> Any:
    """Fetch all partner withdrawal requests on Admin Panel for manual payment approval."""
    if status:
        requests = await WithdrawalRequest.find(
            WithdrawalRequest.status == status
        ).sort("-created_at").to_list()
    else:
        requests = await WithdrawalRequest.find_all().sort("-created_at").to_list()

    data = [
        WithdrawalResponse(
            request_id=r.request_id,
            partner_id=r.partner_id,
            partner_name=r.partner_name,
            amount=r.amount,
            payout_method=r.payout_method,
            upi_id=r.upi_id,
            bank_account_number=r.bank_account_number,
            ifsc_code=r.ifsc_code,
            account_holder_name=r.account_holder_name,
            status=r.status,
            admin_notes=r.admin_notes,
            transaction_reference=r.transaction_reference,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in requests
    ]
    return APIResponse(
        success=True,
        message="Admin withdrawal requests fetched successfully",
        data=data,
    )


@router.patch("/admin/withdrawals/{request_id}/approve", response_model=APIResponse[WithdrawalResponse])
async def approve_admin_withdrawal(
    request_id: str,
    obj_in: AdminWithdrawalApproval,
    admin: User = Depends(get_current_admin),
) -> Any:

    """
    Admin manual payout approval or rejection endpoint.
    Upon pressing Approve, the requested amount is permanently deducted from the partner's wallet.
    """
    updated = await wallet_service.process_admin_withdrawal_approval(
        request_id=request_id, obj_in=obj_in
    )
    status_str = "approved and balance deducted" if updated.status == WithdrawalStatus.APPROVED else "rejected"
    return APIResponse(
        success=True,
        message=f"Withdrawal request '{request_id}' has been {status_str} successfully.",
        data=WithdrawalResponse(
            request_id=updated.request_id,
            partner_id=updated.partner_id,
            partner_name=updated.partner_name,
            amount=updated.amount,
            payout_method=updated.payout_method,
            upi_id=updated.upi_id,
            bank_account_number=updated.bank_account_number,
            ifsc_code=updated.ifsc_code,
            account_holder_name=updated.account_holder_name,
            status=updated.status,
            admin_notes=updated.admin_notes,
            transaction_reference=updated.transaction_reference,
            created_at=updated.created_at,
            updated_at=updated.updated_at,
        ),
    )
