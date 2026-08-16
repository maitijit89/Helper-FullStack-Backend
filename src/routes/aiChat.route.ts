import { Router, Request, Response, NextFunction } from 'express';
import { aiChatService } from '../services/aiChat.service';

const router = Router();

router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt, history } = req.body;
    if (!prompt) {
      res.status(400).json({ success: false, detail: 'Prompt is required' });
      return;
    }

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
