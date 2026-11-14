import { Router, Request, Response } from 'express';
import axios from 'axios';
import { env } from '../config/env';

const router = Router();

let cachedStatus: any = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5000; // 5-second in-memory cache for high-throughput mobile app splash checks

/**
 * @route   GET /api/v1/app-control
 * @desc    Public status check for mobile apps on launch.
 *          Returns whether User App or Partner App is paused by administrative killswitch.
 */
router.get('/', async (req: Request, res: Response) => {
  const targetApp = req.query.app as string | undefined;

  if (cachedStatus && cacheExpiresAt > Date.now()) {
    if (targetApp === 'user') {
      return res.status(200).json({ success: true, user_app: cachedStatus.user_app });
    }
    if (targetApp === 'partner') {
      return res.status(200).json({ success: true, partner_app: cachedStatus.partner_app });
    }
    return res.status(200).json({ success: true, ...cachedStatus });
  }

  // Attempt to sync from Admin Sub-Backend (Backend 4 on port 8003)
  const adminBackendUrl = process.env.ADMIN_SUB_BACKEND_URL || 'http://localhost:8003';
  let liveStatus = {
    user_app: {
      is_stopped: false,
      title: 'App Operational',
      message: 'All systems operational.',
      stopped_at: null,
    },
    partner_app: {
      is_stopped: false,
      title: 'Partner Operations Active',
      message: 'Fleet dispatch running normally.',
      stopped_at: null,
    },
  };

  try {
    const adminRes = await axios.get(`${adminBackendUrl.replace(/\/+$/, '')}/api/v1/app-control`, {
      timeout: 1500,
    });
    if (adminRes.data) {
      liveStatus = {
        user_app: adminRes.data.user_app || liveStatus.user_app,
        partner_app: adminRes.data.partner_app || liveStatus.partner_app,
      };
    }
  } catch {
    // Graceful offline fallback: keep operational defaults
  }

  cachedStatus = liveStatus;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  if (targetApp === 'user') {
    return res.status(200).json({ success: true, user_app: liveStatus.user_app });
  }
  if (targetApp === 'partner') {
    return res.status(200).json({ success: true, partner_app: liveStatus.partner_app });
  }

  return res.status(200).json({
    success: true,
    ...liveStatus,
  });
});

export default router;
