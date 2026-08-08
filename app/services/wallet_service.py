import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from beanie.operators import GTE, LTE, In

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.wallet import PartnerWallet, TransactionType, WalletTransaction
from app.models.withdrawal import PayoutMethod, WithdrawalRequest, WithdrawalStatus
from app.schemas.wallet import (
    AdminWithdrawalApproval,
    PartnerWalletResponse,
    WalletTransactionResponse,
    WithdrawalCreate,
    WithdrawalResponse,
)

logger = logging.getLogger(__name__)


class WalletService:
    def _generate_request_id(self) -> str:
        rand_str = "".join(secrets.choice("0123456789") for _ in range(6))
        return f"WTH-{rand_str}"

    async def get_or_create_partner_wallet(self, partner_id: str) -> PartnerWallet:
        """Fetch existing PartnerWallet or initialize a new wallet for delivery partner."""
        wallet = await PartnerWallet.find_one(PartnerWallet.partner_id == partner_id)
        if not wallet:
            wallet = PartnerWallet(
                partner_id=partner_id,
                total_balance=0.0,
                pending_withdrawal_balance=0.0,
                total_withdrawn=0.0,
            )
            await wallet.insert()
        return wallet

    async def credit_partner_earnings(
        self, partner_id: str, order_id: str, delivery_fee: float
    ) -> PartnerWallet:
        """
        Credit order delivery fee to Partner Wallet upon order completion.
        """
        if delivery_fee <= 0:
            return await self.get_or_create_partner_wallet(partner_id)

        wallet = await self.get_or_create_partner_wallet(partner_id)
        wallet.total_balance += delivery_fee
        wallet.touch()
        await wallet.save()

        # Log Earning Transaction
        transaction = WalletTransaction(
            partner_id=partner_id,
            order_id=order_id,
            amount=delivery_fee,
            transaction_type=TransactionType.EARNING,
            description=f"Delivery earnings for Order {order_id}",
        )
        await transaction.insert()

        logger.info(
            "Credited RS %.2f delivery fee to partner %s for order %s",
            delivery_fee,
            partner_id,
            order_id,
        )
        return wallet

    async def get_partner_wallet_summary(self, partner_id: str) -> PartnerWalletResponse:
        """
        Calculate wallet balance and 48-hour withdrawable balance for delivery partner.
        48-hour rule: Only earnings created at or before (now - 48 hours) are withdrawable.
        """
        wallet = await self.get_or_create_partner_wallet(partner_id)
        now = datetime.now(timezone.utc)
        cutoff_48h = now - timedelta(hours=48)

        # Sum all earnings older than 48 hours
        all_earnings = await WalletTransaction.find(
            WalletTransaction.partner_id == partner_id,
            WalletTransaction.transaction_type == TransactionType.EARNING,
        ).to_list()

        eligible_earnings = [
            t for t in all_earnings
            if (t.created_at.tzinfo is None and t.created_at <= cutoff_48h.replace(tzinfo=None))
            or (t.created_at.tzinfo is not None and t.created_at <= cutoff_48h)
        ]

        total_48h_earnings = sum(t.amount for t in eligible_earnings)


        # Calculate withdrawable balance = (48h eligible earnings) - (already withdrawn + pending withdrawals)
        withdrawable = max(
            0.0,
            total_48h_earnings - (wallet.total_withdrawn + wallet.pending_withdrawal_balance),
        )
        # Cap withdrawable balance by actual current total_balance
        withdrawable = min(withdrawable, max(0.0, wallet.total_balance - wallet.pending_withdrawal_balance))

        # Recent transactions
        transactions = (
            await WalletTransaction.find(WalletTransaction.partner_id == partner_id)
            .sort("-created_at")
            .limit(20)
            .to_list()
        )

        recent_txs = [
            WalletTransactionResponse(
                id=str(t.id),
                partner_id=t.partner_id,
                order_id=t.order_id,
                amount=t.amount,
                transaction_type=t.transaction_type,
                description=t.description,
                created_at=t.created_at,
            )
            for t in transactions
        ]

        return PartnerWalletResponse(
            partner_id=partner_id,
            total_balance=round(wallet.total_balance, 2),
            withdrawable_balance=round(withdrawable, 2),
            pending_withdrawal_balance=round(wallet.pending_withdrawal_balance, 2),
            total_withdrawn=round(wallet.total_withdrawn, 2),
            holding_period_hours=48,
            recent_transactions=recent_txs,
        )

    async def create_withdrawal_request(
        self, partner_id: str, partner_name: str, obj_in: WithdrawalCreate
    ) -> WithdrawalRequest:
        """
        Submit a partner payout request after validating 48-hour withdrawable balance holding requirement.
        """
        summary = await self.get_partner_wallet_summary(partner_id)

        if obj_in.amount > summary.withdrawable_balance:
            raise BadRequestException(
                f"Requested withdrawal amount (RS {obj_in.amount:.2f}) exceeds your 48-hour "
                f"withdrawable balance (RS {summary.withdrawable_balance:.2f}). "
                f"Earnings require a 48-hour holding period before withdrawal."
            )

        wallet = await self.get_or_create_partner_wallet(partner_id)
        wallet.pending_withdrawal_balance += obj_in.amount
        wallet.touch()
        await wallet.save()

        request = WithdrawalRequest(
            request_id=self._generate_request_id(),
            partner_id=partner_id,
            partner_name=partner_name,
            amount=obj_in.amount,
            payout_method=obj_in.payout_method,
            upi_id=obj_in.upi_id,
            bank_account_number=obj_in.bank_account_number,
            ifsc_code=obj_in.ifsc_code,
            account_holder_name=obj_in.account_holder_name,
            status=WithdrawalStatus.PENDING,
        )
        await request.insert()

        logger.info(
            "Created withdrawal request %s for partner %s (RS %.2f)",
            request.request_id,
            partner_id,
            obj_in.amount,
        )
        return request

    async def process_admin_withdrawal_approval(
        self, request_id: str, obj_in: AdminWithdrawalApproval
    ) -> WithdrawalRequest:
        """
        Admin approves or rejects a manual partner payout request.
        Upon approval, the amount is permanently deducted from the partner's wallet balance.
        """
        request = await WithdrawalRequest.find_one(WithdrawalRequest.request_id == request_id)
        if not request:
            raise NotFoundException(f"Withdrawal request '{request_id}' not found.")

        if request.status != WithdrawalStatus.PENDING:
            raise BadRequestException(
                f"Withdrawal request '{request_id}' has already been processed with status '{request.status.value}'."
            )

        wallet = await self.get_or_create_partner_wallet(request.partner_id)

        if obj_in.status == WithdrawalStatus.APPROVED:
            # Deduct from locked pending balance and total balance
            wallet.pending_withdrawal_balance = max(0.0, wallet.pending_withdrawal_balance - request.amount)
            wallet.total_balance = max(0.0, wallet.total_balance - request.amount)
            wallet.total_withdrawn += request.amount
            wallet.touch()
            await wallet.save()

            # Record Withdrawal Transaction
            tx = WalletTransaction(
                partner_id=request.partner_id,
                amount=request.amount,
                transaction_type=TransactionType.WITHDRAWAL,
                description=f"Withdrawal payout approved ({request.payout_method.value.upper()}) - Ref: {obj_in.transaction_reference or 'Manual Payout'}",
            )
            await tx.insert()

            request.status = WithdrawalStatus.APPROVED
            request.admin_notes = obj_in.admin_notes
            request.transaction_reference = obj_in.transaction_reference
            request.touch()
            await request.save()

            logger.info("Admin approved withdrawal request %s for partner %s", request_id, request.partner_id)

        elif obj_in.status == WithdrawalStatus.REJECTED:
            # Unlock locked pending balance back to available balance
            wallet.pending_withdrawal_balance = max(0.0, wallet.pending_withdrawal_balance - request.amount)
            wallet.touch()
            await wallet.save()

            request.status = WithdrawalStatus.REJECTED
            request.admin_notes = obj_in.admin_notes or "Withdrawal request rejected by Admin."
            request.touch()
            await request.save()

            logger.info("Admin rejected withdrawal request %s for partner %s", request_id, request.partner_id)

        else:
            raise BadRequestException("Invalid withdrawal status. Must be 'approved' or 'rejected'.")

        return request


wallet_service = WalletService()
