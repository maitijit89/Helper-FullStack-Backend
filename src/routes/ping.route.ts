import { Router, Request, Response, NextFunction } from 'express';
import { pingService } from '../services/ping.service';
import { authenticate } from '../middlewares/auth';
import { livePresencePingSchema } from '../schemas/ping.schema';

const router = Router();

/**
 * @route   GET /api/v1/ping
 * @desc    Ultra-fast L4/L7 live ping & heartbeat for load balancers and uptime probes
 */
router.get('/', (_req: Request, res: Response) => {
  const result = pingService.getBasicPing();
  res.status(200).json(result);
});

/**
 * @route   GET /api/v1/ping/deep
 * @desc    Deep live diagnostic ping: Measures round-trip latency across all 3 databases & caches
 */
router.get('/deep', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pingService.getDeepLivePing();
    const statusCode = result.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/ping/live
 * @desc    Alias for deep live diagnostic ping
 */
router.get('/live', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pingService.getDeepLivePing();
    const statusCode = result.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/ping/presence
 * @desc    Submit authenticated live presence heartbeat ping from User App or Partner Portal
 */
router.post('/presence', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = livePresencePingSchema.parse(req.body);
    const userId = req.user!._id.toString();
    const role = req.user!.role;

    const presence = await pingService.recordPresence(userId, role, validated);

    res.status(200).json({
      success: true,
      message: 'Live presence heartbeat recorded.',
      data: presence,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/ping/presence
 * @desc    Get aggregate count of currently active online users and partners
 */
router.get('/presence', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const counts = await pingService.getActivePresenceCounts();
    res.status(200).json({
      success: true,
      data: counts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/ping/presence/:userId
 * @desc    Check if a specific user or delivery partner is currently online
 */
router.get('/presence/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const presence = await pingService.getPresence(req.params.userId);
    res.status(200).json({
      success: true,
      data: presence,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/ping/stream
 * @desc    Server-Sent Events (SSE) live heartbeat stream (emits ping every 5 seconds)
 */
router.get('/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Initial ping
  const initial = pingService.getBasicPing();
  res.write(`data: ${JSON.stringify(initial)}\n\n`);

  if (req.query.once === 'true') {
    res.end();
    return;
  }

  // Stream heartbeat every 5 seconds
  const intervalId = setInterval(() => {
    const ping = pingService.getBasicPing();
    res.write(`data: ${JSON.stringify(ping)}\n\n`);
  }, 5000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
  });
});

export default router;
