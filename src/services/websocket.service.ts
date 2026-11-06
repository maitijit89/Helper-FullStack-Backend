import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { logger } from '../config/logger';
import { verifyToken } from '../utils/security';
import { User, UserRole } from '../models/User';
import { redisService } from './redis.service';
import { geoService } from './geo.service';

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  role?: string;
  isAlive?: boolean;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private partnerSockets: Map<string, ExtendedWebSocket> = new Map();
  private customerSockets: Map<string, Set<ExtendedWebSocket>> = new Map();
  private lastLocationWrite: Map<string, { time: number; lat: number; lng: number }> = new Map();
  private isClusterSubscribed: boolean = false;

  initialize(wss: WebSocketServer) {
    this.wss = wss;

    if (!this.isClusterSubscribed) {
      this.isClusterSubscribed = true;
      this.setupClusterPubSub();
    }

    this.wss.on('connection', async (ws: ExtendedWebSocket, req: IncomingMessage) => {
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Parse token from query string
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (token) {
        try {
          const payload = verifyToken(token);
          ws.userId = payload.sub;
          ws.role = payload.role;

          const isPartner =
            payload.role === UserRole.PARTNER ||
            payload.role === UserRole.SUPER ||
            (payload.roles && payload.roles.includes(UserRole.PARTNER));

          if (isPartner) {
            this.partnerSockets.set(payload.sub, ws);
            logger.info(`Delivery Partner / Super Account connected via WS: ${payload.sub}`);
          } else {
            if (!this.customerSockets.has(payload.sub)) {
              this.customerSockets.set(payload.sub, new Set());
            }
            this.customerSockets.get(payload.sub)!.add(ws);
            logger.info(`Customer connected via WS: ${payload.sub}`);
          }
        } catch {
          logger.warn('WS connection established without valid auth token');
        }
      }

      ws.on('message', async (data: string) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleClientMessage(ws, message);
        } catch (err: any) {
          logger.warn(`Invalid WS message payload: ${err.message}`);
        }
      });

      ws.on('close', () => {
        if (ws.userId) {
          if (ws.role === UserRole.PARTNER || ws.role === UserRole.SUPER) {
            this.partnerSockets.delete(ws.userId);
          } else {
            const userSet = this.customerSockets.get(ws.userId);
            if (userSet) {
              userSet.delete(ws);
              if (userSet.size === 0) {
                this.customerSockets.delete(ws.userId);
              }
            }
          }
        }
      });
    });

    // Heartbeat ping interval
    setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((client) => {
        const ws = client as ExtendedWebSocket;
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  private setupClusterPubSub() {
    redisService.subscribe('ws:partner', (msg) => {
      try {
        const { partnerId, event, data } = JSON.parse(msg);
        this.notifyPartner(partnerId, event, data, true);
      } catch (err: any) {
        logger.warn(`Failed to parse ws:partner cluster message: ${err.message}`);
      }
    });

    redisService.subscribe('ws:customer', (msg) => {
      try {
        const { customerId, event, data } = JSON.parse(msg);
        this.notifyCustomer(customerId, event, data, true);
      } catch (err: any) {
        logger.warn(`Failed to parse ws:customer cluster message: ${err.message}`);
      }
    });

    redisService.subscribe('ws:broadcast', (msg) => {
      try {
        const { event, data } = JSON.parse(msg);
        if (event === 'partner_location_updated' && data.partner_id && data.location) {
          this.broadcastPartnerLocation(data.partner_id, data.location, true);
        } else if (event === 'app_status_changed') {
          this.broadcastEvent(event, data, true);
        }
      } catch (err: any) {
        logger.warn(`Failed to parse ws:broadcast cluster message: ${err.message}`);
      }
    });

    redisService.subscribe('ws:disconnect', (msg) => {
      try {
        const { partnerId } = JSON.parse(msg);
        this.disconnectPartner(partnerId, true);
      } catch (err: any) {
        logger.warn(`Failed to parse ws:disconnect cluster message: ${err.message}`);
      }
    });
  }

  private async handleClientMessage(ws: ExtendedWebSocket, message: any) {
    const isPartner = ws.role === UserRole.PARTNER || ws.role === UserRole.SUPER;
    if (message.type === 'update_location' && ws.userId && isPartner) {
      const { latitude, longitude, accuracy, address } = message.data || {};
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        const partnerId = ws.userId;
        const now = Date.now();

        // 1. Instant Real-time WebSocket broadcast to assigned customers
        this.broadcastPartnerLocation(partnerId, { latitude, longitude });

        // 2. High-speed Redis geospatial cache update (sub-millisecond)
        redisService.geoAdd('partner:locations', longitude, latitude, partnerId).catch(() => {});

        // 3. Throttled MongoDB persistent write (every 10s or if moved > 50 meters)
        const lastWrite = this.lastLocationWrite.get(partnerId);
        const shouldWriteDb =
          !lastWrite ||
          now - lastWrite.time >= 10000 ||
          geoService.calculateDistance(
            { latitude, longitude },
            { latitude: lastWrite.lat, longitude: lastWrite.lng }
          ) >= 0.05;

        if (shouldWriteDb) {
          this.lastLocationWrite.set(partnerId, { time: now, lat: latitude, lng: longitude });
          User.findByIdAndUpdate(partnerId, {
            location: { latitude, longitude, accuracy, address, timestamp: new Date() },
            is_gps_enabled: true,
            'partner_profile.is_online': true,
          }).catch((err) => {
            logger.warn(`Async partner location DB update error: ${err.message}`);
          });
        }
      }
    }
  }

  notifyPartner(partnerId: string, event: string, payload: any, fromCluster: boolean = false) {
    const ws = this.partnerSockets.get(partnerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, data: payload }));
    }

    if (!fromCluster) {
      redisService.publish('ws:partner', JSON.stringify({ partnerId, event, data: payload })).catch(() => {});
    }
  }

  disconnectPartner(partnerId: string, fromCluster: boolean = false) {
    const ws = this.partnerSockets.get(partnerId);
    if (ws) {
      try {
        ws.close(1000, 'Partner logged out');
      } catch {
        // ignore
      }
      this.partnerSockets.delete(partnerId);
      this.lastLocationWrite.delete(partnerId);
      logger.info(`Delivery Partner WS disconnected: ${partnerId}`);
    }

    if (!fromCluster) {
      redisService.publish('ws:disconnect', JSON.stringify({ partnerId })).catch(() => {});
    }
  }

  notifyCustomer(customerId: string, event: string, payload: any, fromCluster: boolean = false) {
    const sockets = this.customerSockets.get(customerId);
    if (sockets) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event, data: payload }));
        }
      }
    }

    if (!fromCluster) {
      redisService.publish('ws:customer', JSON.stringify({ customerId, event, data: payload })).catch(() => {});
    }
  }

  broadcastPartnerLocation(partnerId: string, location: { latitude: number; longitude: number }, fromCluster: boolean = false) {
    const message = JSON.stringify({
      event: 'partner_location_updated',
      data: { partner_id: partnerId, location },
    });

    // Broadcast to all active customer connections on this worker
    this.customerSockets.forEach((sockets) => {
      sockets.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    });

    if (!fromCluster) {
      redisService.publish('ws:broadcast', message).catch(() => {});
    }
  }

  broadcastEvent(event: string, payload: any, fromCluster: boolean = false) {
    const message = JSON.stringify({ event, data: payload });

    if (this.wss) {
      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }

    if (!fromCluster) {
      redisService.publish('ws:broadcast', message).catch(() => {});
    }
  }
}

export const wsManager = new WebSocketManager();
