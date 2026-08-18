import { Router, Response, NextFunction } from 'express';
import { authenticate, optionalAuthenticate, AuthenticatedRequest } from '../middlewares/auth';
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

// Get user's own tickets (Requires Authentication)
router.get('/my-tickets', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!._id.toString();
    const userEmail = req.user!.email;

    const tickets = await SupportTicket.find({
      $or: [{ user_id: userId }, { email: userEmail }],
    }).sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      data: tickets,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
