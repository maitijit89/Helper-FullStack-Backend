import { Router, Response, NextFunction } from 'express';
import { optionalAuthenticate, AuthenticatedRequest } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { CreateSupportTicketSchema } from '../schemas/support.schema';
import { SupportTicket, SupportTicketStatus } from '../models/SupportTicket';

const router = Router();

// Create a support report / ticket
router.post('/', optionalAuthenticate, validate(CreateSupportTicketSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone, subject, details } = req.body;
    const ticketId = `TICK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const ticket = new SupportTicket({
      ticket_id: ticketId,
      user_id: req.user?._id?.toString(),
      name,
      email,
      phone,
      subject,
      details,
      status: SupportTicketStatus.PENDING,
    });
    await ticket.save();

    res.status(201).json({
      success: true,
      message: 'Support ticket submitted successfully. Our team will contact you soon.',
      data: ticket,
    });
  } catch (err) {
    next(err);
  }
});

// Get user's own tickets
router.get('/my-tickets', optionalAuthenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filter: any = {};
    if (req.user) {
      filter.$or = [{ user_id: req.user._id.toString() }, { email: req.user.email }];
    } else if (req.query.email) {
      filter.email = String(req.query.email);
    } else {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    const tickets = await SupportTicket.find(filter).sort({ created_at: -1 });
    res.status(200).json({
      success: true,
      data: tickets,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
