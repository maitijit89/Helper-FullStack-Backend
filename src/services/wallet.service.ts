import { PartnerWallet, IPartnerWallet, WalletTransaction, TransactionType } from '../models/PartnerWallet';
import { WithdrawalRequest, IWithdrawalRequest, WithdrawalStatus, PayoutMethod } from '../models/WithdrawalRequest';
import { BadRequestException, NotFoundException } from '../middlewares/errorHandler';
import { logger } from '../config/logger';

class WalletService {
  async getOrCreateWallet(partnerId: string): Promise<IPartnerWallet> {
    let wallet = await PartnerWallet.findOne({ partner_id: partnerId });
    if (!wallet) {
      wallet = new PartnerWallet({
        partner_id: partnerId,
        total_balance: 0,
        pending_withdrawal_balance: 0,
        total_withdrawn: 0,
      });
      await wallet.save();
    }
    return wallet;
  }

  /**
   * Credits delivery earnings to the partner wallet upon order delivery completion.
   */
  async creditOrderEarnings(partnerId: string, orderId: string, deliveryFee: number): Promise<void> {
    // Prevent duplicate credits for the same order
    const existingTx = await WalletTransaction.findOne({
      order_id: orderId,
      transaction_type: TransactionType.EARNING,
    });
    if (existingTx) {
      logger.warn(`Earnings for order #${orderId} already credited. Skipping duplicate credit.`);
      return;
    }

    const wallet = await this.getOrCreateWallet(partnerId);

    wallet.total_balance = +(wallet.total_balance + deliveryFee).toFixed(2);
    wallet.touch();
    await wallet.save();

    const transaction = new WalletTransaction({
      partner_id: partnerId,
      order_id: orderId,
      amount: deliveryFee,
      transaction_type: TransactionType.EARNING,
      description: `Delivery fee earnings for order #${orderId}`,
    });
    await transaction.save();

    logger.info(`Credited ₹${deliveryFee} to partner ${partnerId} for order #${orderId}`);
  }

  /**
   * Returns a structured earnings history breakdown for partner analytics.
   */
  async getEarningsHistory(partnerId: string): Promise<any> {
    const wallet = await this.getOrCreateWallet(partnerId);
    const balanceInfo = await this.getWithdrawableBalance(partnerId);
    const transactions = await WalletTransaction.find({ partner_id: partnerId }).sort({ created_at: -1 });

    const totalOrdersCompleted = transactions.filter(t => t.transaction_type === TransactionType.EARNING).length;

    return {
      total_balance: wallet.total_balance,
      withdrawable_balance: balanceInfo.withdrawable_balance,
      pending_balance: balanceInfo.pending_balance,
      total_withdrawn: wallet.total_withdrawn,
      total_completed_trips: totalOrdersCompleted,
      transactions,
    };
  }

  /**
   * Calculates the currently withdrawable balance based on earnings that have matured past the 48-hour holding period.
   */
  async getWithdrawableBalance(partnerId: string): Promise<{ total_balance: number; withdrawable_balance: number; pending_balance: number }> {
    const wallet = await this.getOrCreateWallet(partnerId);

    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // Sum of all earnings created before 48 hours ago
    const maturedEarnings = await WalletTransaction.aggregate([
      {
        $match: {
          partner_id: partnerId,
          transaction_type: TransactionType.EARNING,
          created_at: { $lte: fortyEightHoursAgo },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const maturedTotal = maturedEarnings[0]?.total || 0.0;
    const withdrawable = Math.max(0, +(maturedTotal - wallet.total_withdrawn - wallet.pending_withdrawal_balance).toFixed(2));

    return {
      total_balance: wallet.total_balance,
      withdrawable_balance: Math.min(withdrawable, wallet.total_balance - wallet.pending_withdrawal_balance),
      pending_balance: wallet.pending_withdrawal_balance,
    };
  }

  /**
   * Initiates a withdrawal request.
   */
  async requestWithdrawal(
    partnerId: string,
    partnerName: string,
    amount: number,
    payoutMethod: PayoutMethod,
    details: { upi_id?: string; bank_account_number?: string; ifsc_code?: string; account_holder_name?: string }
  ): Promise<IWithdrawalRequest> {
    const { withdrawable_balance } = await this.getWithdrawableBalance(partnerId);

    if (amount > withdrawable_balance) {
      throw new BadRequestException(
        `Requested amount ₹${amount} exceeds withdrawable balance ₹${withdrawable_balance}. (Note: 48-hour holding period applies to recent earnings).`
      );
    }

    const wallet = await this.getOrCreateWallet(partnerId);
    wallet.pending_withdrawal_balance = +(wallet.pending_withdrawal_balance + amount).toFixed(2);
    wallet.touch();
    await wallet.save();

    const requestId = `WR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const withdrawalRequest = new WithdrawalRequest({
      request_id: requestId,
      partner_id: partnerId,
      partner_name: partnerName,
      amount,
      payout_method: payoutMethod,
      upi_id: details.upi_id,
      bank_account_number: details.bank_account_number,
      ifsc_code: details.ifsc_code,
      account_holder_name: details.account_holder_name,
      status: WithdrawalStatus.PENDING,
    });
    await withdrawalRequest.save();

    return withdrawalRequest;
  }

  /**
   * Process withdrawal request approval or rejection by admin.
   */
  async processWithdrawal(
    requestId: string,
    status: WithdrawalStatus,
    adminNotes?: string,
    transactionReference?: string
  ): Promise<IWithdrawalRequest> {
    const request = await WithdrawalRequest.findOne({ request_id: requestId });
    if (!request) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (request.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(`Request is already ${request.status}`);
    }

    const wallet = await this.getOrCreateWallet(request.partner_id);

    if (status === WithdrawalStatus.APPROVED) {
      wallet.pending_withdrawal_balance = Math.max(0, +(wallet.pending_withdrawal_balance - request.amount).toFixed(2));
      wallet.total_balance = Math.max(0, +(wallet.total_balance - request.amount).toFixed(2));
      wallet.total_withdrawn = +(wallet.total_withdrawn + request.amount).toFixed(2);

      const transaction = new WalletTransaction({
        partner_id: request.partner_id,
        amount: request.amount,
        transaction_type: TransactionType.WITHDRAWAL,
        description: `Payout processed for withdrawal request ${request.request_id} (Ref: ${transactionReference || 'N/A'})`,
      });
      await transaction.save();
    } else if (status === WithdrawalStatus.REJECTED) {
      wallet.pending_withdrawal_balance = Math.max(0, +(wallet.pending_withdrawal_balance - request.amount).toFixed(2));
    }

    wallet.touch();
    await wallet.save();

    request.status = status;
    request.admin_notes = adminNotes;
    request.transaction_reference = transactionReference;
    request.touch();
    await request.save();

    return request;
  }
}

export const walletService = new WalletService();
