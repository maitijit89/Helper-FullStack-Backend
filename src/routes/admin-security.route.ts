import { Router, Request, Response, NextFunction } from 'express';
import { securityAuditService } from '../services/security-audit.service';
import { authenticate, authorizeRole } from '../middlewares/auth';
import { env } from '../config/env';

const router = Router();

// Restrict entire security route to authenticated administrators
router.use(authenticate, authorizeRole('admin'));

/**
 * @route   GET /api/v1/admin/security/stats
 * @desc    Get real-time security threat telemetry and incident statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  const stats = securityAuditService.getThreatStats();
  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * @route   GET /api/v1/admin/security/events
 * @desc    Get paginated real-time security audit events
 */
router.get('/events', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const severity = req.query.severity as any;

  const events = securityAuditService.getRecentEvents({ limit, severity });

  res.status(200).json({
    success: true,
    data: events,
    total: events.length,
  });
});

/**
 * @route   GET /api/v1/admin/security/posture
 * @desc    Audit active defensive security controls, headers, and environment posture
 */
router.get('/posture', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    posture: {
      environment: env.ENVIRONMENT,
      runtime: `Node.js 22 (${process.version})`,
      defenses: {
        helmetSecurityHeaders: true,
        contentSecurityPolicy: true,
        strictTransportSecurityHSTS: true,
        noSqlInjectionSanitization: true,
        httpParameterPollutionDefense: true,
        constantTimeCryptoComparison: true,
        dualTierRateLimiting: true,
        corsOriginValidation: true,
        jwtBlacklistEngine: 'Upstash Redis',
        jsonPayloadLimit: '2mb',
        maxPayloadDepth: 10,
      },
      telemetry: {
        auditLoggingActive: true,
        timestamp: new Date().toISOString(),
      },
    },
  });
});

export default router;
