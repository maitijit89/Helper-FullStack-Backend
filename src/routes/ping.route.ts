import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { pingService } from '../services/ping.service';
import { authenticate } from '../middlewares/auth';
import { livePresencePingSchema } from '../schemas/ping.schema';

const router = Router();

/**
 * @route   GET /api/v1/ping/ecosystem
 * @desc    Deep multi-backend cluster interconnection probe:
 *          Pings all 4 backends (Main: 8000, Telemetry: 8001, Partner: 8002, Admin: 8003)
 *          and measures inter-service latency and connectivity status.
 */
router.get('/ecosystem', async (_req: Request, res: Response) => {
  const targets = [
    { name: 'backend2_telemetry', url: process.env.TELEMETRY_SUB_BACKEND_URL || 'http://localhost:8001', port: 8001 },
    { name: 'backend3_partner', url: process.env.PARTNER_SUB_BACKEND_URL || 'http://localhost:8002', port: 8002 },
    { name: 'backend4_admin', url: process.env.ADMIN_SUB_BACKEND_URL || 'http://localhost:8003', port: 8003 },
  ];

  const results: Record<string, any> = {
    backend1_main: {
      port: 8000,
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  };

  let connectedCount = 1;

  await Promise.all(
    targets.map(async (target) => {
      const start = Date.now();
      try {
        const probeRes = await axios.get(`${target.url.replace(/\/+$/, '')}/ping`, {
          timeout: 1500,
        });
        const latencyMs = Date.now() - start;
        connectedCount += 1;
        results[target.name] = {
          port: target.port,
          status: 'connected',
          latencyMs,
          pong: probeRes.data?.pong ?? true,
        };
      } catch (err: any) {
        results[target.name] = {
          port: target.port,
          status: 'offline',
          error: err.code === 'ECONNREFUSED' ? 'Service not running on port' : err.message,
        };
      }
    })
  );

  res.status(200).json({
    status: 'ok',
    totalBackends: 4,
    connectedBackends: connectedCount,
    interconnectionHealthy: connectedCount > 1,
    ecosystem: results,
    timestamp: new Date().toISOString(),
  });
});

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
