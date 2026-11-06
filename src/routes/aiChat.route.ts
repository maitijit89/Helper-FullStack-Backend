import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middlewares/validate';
import { AiChatSchema } from '../schemas/aiChat.schema';
import { aiChatService } from '../services/aiChat.service';

const router = Router();

router.post('/chat', validate(AiChatSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, history } = req.body;
    const reply = await aiChatService.askAssistant(prompt, history);
    res.status(200).json({
      success: true,
      data: {
        reply,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
