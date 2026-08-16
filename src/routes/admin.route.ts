import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  VerifyPartnerSchema,
  ModerateRatingSchema,
  UpdateSupportTicketStatusSchema,
  ProcessWithdrawalSchema,
  AdminUsersQuerySchema,
  AdminPartnersQuerySchema,
  AdminOrdersQuerySchema,
} from '../schemas/admin.schema';
import { User, UserRole, PartnerVerificationStatus } from '../models/User';
import { Order, OrderStatus } from '../models/Order';
import { Rating } from '../models/Rating';
import { SupportTicket, SupportTicketStatus } from '../models/SupportTicket';
import { WithdrawalRequest, WithdrawalStatus } from '../models/WithdrawalRequest';
import { walletService } from '../services/wallet.service';
import { googleSheetsService } from '../services/googleSheets.service';
import { NotFoundException, BadRequestException } from '../middlewares/errorHandler';

const router = Router();

// Require admin authentication for all endpoints here
router.use(authenticate, requireAdmin);

// 1. User & Partner Management
router.get('/users', validate(AdminUsersQuerySchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { role, limit = 50, skip = 0 } = req.query;
    const filter: any = {};
    if (role) filter.role = role;

    const users = await User.find(filter)
      .sort({ created_at: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      total,
      data: users,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/partners', validate(AdminPartnersQuerySchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const filter: any = { role: UserRole.PARTNER };
    if (status) {
      filter['partner_profile.verification_status'] = status;
    }

    const partners = await User.find(filter)
      .sort({ created_at: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      total,
      data: partners,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/partners/:user_id/verify', validate(VerifyPartnerSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, rejection_reason } = req.body;

    const user = await User.findById(req.params.user_id);
    if (!user || user.role !== UserRole.PARTNER || !user.partner_profile) {
      throw new NotFoundException('Partner not found');
    }

    user.partner_profile.verification_status = status;
    if (status === PartnerVerificationStatus.APPROVED) {
      user.partner_profile.approved_at = new Date();
      user.partner_profile.rejection_reason = undefined;
    } else {
      user.partner_profile.rejection_reason = rejection_reason;
    }

    user.touch();
    await user.save();

    // Sync status change to Google Sheets
    await googleSheetsService.exportPartnerApplication({
      user_id: user._id.toString(),
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      vehicle_type: user.partner_profile.vehicle_type,
      vehicle_number: user.partner_profile.vehicle_number,
      status: user.partner_profile.verification_status,
      created_at: user.created_at,
    });

    res.status(200).json({
      success: true,
      message: `Partner verification status updated to ${status}`,
      data: user,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Orders Management
router.get('/orders', validate(AdminOrdersQuerySchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, order_type, limit = 50, skip = 0 } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (order_type) filter.order_type = order_type;

    const orders = await Order.find(filter)
      .sort({ created_at: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    const total = await Order.countDocuments(filter);

    res.status(200).json({
      success: true,
      total,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Ratings Moderation
router.get('/ratings', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ratings = await Rating.find().sort({ created_at: -1 });
    res.status(200).json({
      success: true,
      data: ratings,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/ratings/:id/moderate', validate(ModerateRatingSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { is_hidden, admin_notes } = req.body;
    const rating = await Rating.findById(req.params.id);
    if (!rating) {
      throw new NotFoundException('Rating not found');
    }
    if (is_hidden !== undefined) rating.is_hidden = is_hidden;
    if (admin_notes !== undefined) rating.admin_notes = admin_notes;
    rating.touch();
    await rating.save();

    res.status(200).json({
      success: true,
      data: rating,
    });
  } catch (err) {
    next(err);
  }
});

// 4. Support Tickets
router.get('/support-tickets', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tickets = await SupportTicket.find().sort({ created_at: -1 });
    res.status(200).json({
      success: true,
      data: tickets,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/support-tickets/:ticket_id/status', validate(UpdateSupportTicketStatusSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, admin_notes } = req.body;
    const ticket = await SupportTicket.findOne({ ticket_id: req.params.ticket_id });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    ticket.status = status;
    if (admin_notes) ticket.admin_notes = admin_notes;
    if (status === SupportTicketStatus.SOLVED) {
      ticket.resolved_at = new Date();
    }
    await ticket.save();

    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Withdrawal Requests & Payouts
router.get('/withdrawals', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const withdrawals = await WithdrawalRequest.find().sort({ created_at: -1 });
    res.status(200).json({
      success: true,
      data: withdrawals,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/withdrawals/:request_id/process', validate(ProcessWithdrawalSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, admin_notes, transaction_reference } = req.body;

    const updated = await walletService.processWithdrawal(
      req.params.request_id,
      status,
      admin_notes,
      transaction_reference
    );

    res.status(200).json({
      success: true,
      message: `Withdrawal request ${status}`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
