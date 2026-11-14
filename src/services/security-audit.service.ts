import { logger } from '../config/logger';

export type SecurityEventType =
  | 'AUTH_FAILURE'
  | 'AUTH_LOCKED'
  | 'ACCESS_DENIED'
  | 'NOSQL_INJECTION_BLOCKED'
  | 'PARAMETER_POLLUTION_BLOCKED'
  | 'SUSPICIOUS_PAYLOAD'
  | 'RATE_LIMIT_TRIPPED'
  | 'IDOR_ATTEMPT'
  | 'SUB_BACKEND_AUTH_FAILURE';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityAuditEvent {
  id: string;
  timestamp: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  ip: string;
  userAgent?: string;
  userId?: string;
  path: string;
  method: string;
  details?: Record<string, any>;
}

export interface SecurityThreatStats {
  totalIncidents: number;
  incidentsByType: Record<string, number>;
  incidentsBySeverity: Record<string, number>;
  activeThreatCount: number;
  lastIncidentTimestamp?: string;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'otp',
  'token',
  'secret',
  'authorization',
  'cookie',
  'refreshtoken',
  'accesstoken',
  'apikey',
]);

function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitiveData);

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = redactSensitiveData(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export class SecurityAuditService {
  private events: SecurityAuditEvent[] = [];
  private readonly maxEvents: number = 500;
  private threatStats: SecurityThreatStats = {
    totalIncidents: 0,
    incidentsByType: {},
    incidentsBySeverity: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },
    activeThreatCount: 0,
  };

  /**
   * Log and record a security incident
   */
  recordEvent(input: {
    eventType: SecurityEventType;
    severity: SecuritySeverity;
    ip: string;
    userAgent?: string;
    userId?: string;
    path: string;
    method: string;
    details?: Record<string, any>;
  }): SecurityAuditEvent {
    const event: SecurityAuditEvent = {
      id: `SEC-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      eventType: input.eventType,
      severity: input.severity,
      ip: input.ip || '0.0.0.0',
      userAgent: input.userAgent,
      userId: input.userId,
      path: input.path,
      method: input.method,
      details: redactSensitiveData(input.details),
    };

    // Store in circular buffer
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    // Update threat stats
    this.threatStats.totalIncidents += 1;
    this.threatStats.incidentsByType[event.eventType] =
      (this.threatStats.incidentsByType[event.eventType] || 0) + 1;
    this.threatStats.incidentsBySeverity[event.severity] =
      (this.threatStats.incidentsBySeverity[event.severity] || 0) + 1;
    this.threatStats.lastIncidentTimestamp = event.timestamp;

    if (event.severity === 'high' || event.severity === 'critical') {
      this.threatStats.activeThreatCount += 1;
      logger.error(
        `[SECURITY_ALERT] [${event.severity.toUpperCase()}] ${event.eventType} on ${event.method} ${event.path} from IP ${event.ip}`,
        event
      );
    } else {
      logger.warn(
        `[SECURITY_AUDIT] [${event.severity.toUpperCase()}] ${event.eventType} on ${event.method} ${event.path} from IP ${event.ip}`
      );
    }

    return event;
  }

  /**
   * Retrieve recent security audit events
   */
  getRecentEvents(options: { limit?: number; severity?: SecuritySeverity } = {}): SecurityAuditEvent[] {
    let result = this.events;
    if (options.severity) {
      result = result.filter((e) => e.severity === options.severity);
    }
    const limit = Math.min(100, Math.max(1, options.limit || 50));
    return result.slice(0, limit);
  }

  /**
   * Get overall security statistics and threat telemetry
   */
  getThreatStats(): SecurityThreatStats {
    return { ...this.threatStats };
  }

  /**
   * Reset threat stats (primarily for testing purposes)
   */
  clearForTesting(): void {
    this.events = [];
    this.threatStats = {
      totalIncidents: 0,
      incidentsByType: {},
      incidentsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      activeThreatCount: 0,
    };
  }
}

export const securityAuditService = new SecurityAuditService();
