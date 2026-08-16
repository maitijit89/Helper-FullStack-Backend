import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { logger } from '../config/logger';
import { verifyToken } from '../utils/security';
import { User, UserRole } from '../models/User';

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  role?: string;
  isAlive?: boolean;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private partnerSockets: Map<string, ExtendedWebSocket> = new Map();
  private customerSockets: Map<string, Set<ExtendedWebSocket>> = new Map();

  initialize(wss: WebSocketServer) {
    this.wss = wss;

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

          if (payload.role === UserRole.PARTNER) {
            this.partnerSockets.set(payload.sub, ws);
            logger.info(`Delivery Partner connected via WS: ${payload.sub}`);
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
          if (ws.role === UserRole.PARTNER) {
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

  private async handleClientMessage(ws: ExtendedWebSocket, message: any) {
    if (message.type === 'update_location' && ws.userId && ws.role === UserRole.PARTNER) {
      const { latitude, longitude, accuracy, address } = message.data || {};
      if (latitude && longitude) {
        await User.findByIdAndUpdate(ws.userId, {
          location: { latitude, longitude, accuracy, address, timestamp: new Date() },
          is_gps_enabled: true,
          'partner_profile.is_online': true,
        });

        // Broadcast to any order customers currently assigned to this partner
        this.broadcastPartnerLocation(ws.userId, { latitude, longitude });
      }
    }
  }

  notifyPartner(partnerId: string, event: string, payload: any) {
    const ws = this.partnerSockets.get(partnerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, data: payload }));
    }
  }

  notifyCustomer(customerId: string, event: string, payload: any) {
    const sockets = this.customerSockets.get(customerId);
    if (sockets) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event, data: payload }));
        }
      }
    }
  }

  broadcastPartnerLocation(partnerId: string, location: { latitude: number; longitude: number }) {
    const message = JSON.stringify({
      event: 'partner_location_updated',
      data: { partner_id: partnerId, location },
    });

    // Broadcast to all active customer connections
    this.customerSockets.forEach((sockets) => {
      sockets.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    });
  }
}

export const wsManager = new WebSocketManager();
