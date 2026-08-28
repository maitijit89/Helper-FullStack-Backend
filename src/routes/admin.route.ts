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

// Update user status (activate / deactivate)
router.patch('/users/:user_id/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      throw new BadRequestException('is_active boolean field is required');
    }

    const user = await User.findById(req.params.user_id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.is_active = is_active;
    user.touch();
    await user.save();

    res.status(200).json({
      success: true,
      message: `User account has been ${is_active ? 'activated' : 'deactivated'}`,
      data: user,
    });
  } catch (err) {
    next(err);
  }
});

// Update user role
router.patch('/users/:user_id/role', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body;
    if (!role || !Object.values(UserRole).includes(role)) {
      throw new BadRequestException(`Valid role required: ${Object.values(UserRole).join(', ')}`);
    }

    const user = await User.findById(req.params.user_id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.role = role;
    user.touch();
    await user.save();

    res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
      data: user,
    });
  } catch (err) {
    next(err);
  }
});

// Delete user permanently
router.delete('/users/:user_id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByIdAndDelete(req.params.user_id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/partners', validate(AdminPartnersQuerySchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const filter: any = {
      $or: [{ role: { $in: [UserRole.PARTNER, UserRole.SUPER] } }, { roles: UserRole.PARTNER }],
    };
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
    const isPartner =
      user &&
      (user.role === UserRole.PARTNER ||
        user.role === UserRole.SUPER ||
        (user.roles && user.roles.includes(UserRole.PARTNER)) ||
        !!user.partner_profile);

    if (!user || !isPartner || !user.partner_profile) {
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
      pan_card_url: user.partner_profile.pan_card_url,
      aadhaar_url: user.partner_profile.aadhaar_url,
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

// Get single order detail for admin
router.get('/orders/:order_id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const order = await Order.findOne({ order_id: req.params.order_id });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
});

// Admin force-assign or reassign partner to order
router.post('/orders/:order_id/assign-partner', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { partner_id } = req.body;
    if (!partner_id) {
      throw new BadRequestException('partner_id is required');
    }

    const partner = await User.findById(partner_id);
    const isPartner =
      partner &&
      (partner.role === UserRole.PARTNER ||
        partner.role === UserRole.SUPER ||
        (partner.roles && partner.roles.includes(UserRole.PARTNER)));
    if (!partner || !isPartner) {
      throw new NotFoundException('Delivery partner not found');
    }

    const order = await Order.findOne({ order_id: req.params.order_id });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.partner_id = partner._id.toString();
    order.status = OrderStatus.ASSIGNED;
    order.touch();
    await order.save();

    res.status(200).json({
      success: true,
      message: `Order assigned to partner ${partner.full_name || partner.email}`,
      data: order,
    });
  } catch (err) {
    next(err);
  }
});

// Admin cancel active order
router.post('/orders/:order_id/cancel', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const order = await Order.findOne({ order_id: req.params.order_id });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.status = OrderStatus.CANCELLED;
    order.touch();
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order cancelled by admin',
      data: order,
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

    const { recalculatePartnerRating } = await import('./ratings.route');
    await recalculatePartnerRating(rating.partner_id);

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
