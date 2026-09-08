import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest, requirePartnerApproved } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { CreateWithdrawalRequestSchema } from '../schemas/wallet.schema';
import { walletService } from '../services/wallet.service';
import { WalletTransaction } from '../models/PartnerWallet';
import { WithdrawalRequest } from '../models/WithdrawalRequest';

const router = Router();

// Get partner wallet balance & withdrawable mature funds
router.get('/wallet', authenticate, requirePartnerApproved, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const partnerId = req.user!._id.toString();
    const balanceInfo = await walletService.getWithdrawableBalance(partnerId);

    res.status(200).json({
      success: true,
      data: balanceInfo,
    });
  } catch (err) {
    next(err);
  }
});

// Get transactions history
router.get('/wallet/transactions', authenticate, requirePartnerApproved, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const partnerId = req.user!._id.toString();
    const transactions = await WalletTransaction.find({ partner_id: partnerId })
      .sort({ created_at: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (err) {
    next(err);
  }
});

// Get structured earnings history breakdown
router.get('/wallet/earnings-history', authenticate, requirePartnerApproved, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const partnerId = req.user!._id.toString();
    const history = await walletService.getEarningsHistory(partnerId);

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (err) {
    next(err);
  }
});

// Request withdrawal
router.post(
  '/wallet/withdraw',
  authenticate,
  requirePartnerApproved,
  validate(CreateWithdrawalRequestSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const partnerId = req.user!._id.toString();
      const partnerName = req.user!.full_name || req.user!.email;
      const { amount, payout_method, upi_id, bank_account_number, ifsc_code, account_holder_name } = req.body;

      const request = await walletService.requestWithdrawal(partnerId, partnerName, amount, payout_method, {
        upi_id,
        bank_account_number,
        ifsc_code,
        account_holder_name,
      });

      res.status(201).json({
        success: true,
        message: 'Withdrawal request submitted successfully',
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Get withdrawal requests history
router.get('/wallet/withdrawals', authenticate, requirePartnerApproved, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const partnerId = req.user!._id.toString();
    const requests = await WithdrawalRequest.find({ partner_id: partnerId })
      .sort({ created_at: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
