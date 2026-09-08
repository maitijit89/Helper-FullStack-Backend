import { AppControl, IAppControl } from '../models/AppControl';
import { logger } from '../config/logger';
import { wsManager } from './websocket.service';

export interface AppControlState {
  user_app: {
    is_stopped: boolean;
    title: string;
    message: string;
    stopped_at?: string | null;
    stopped_by?: string | null;
  };
  partner_app: {
    is_stopped: boolean;
    title: string;
    message: string;
    stopped_at?: string | null;
    stopped_by?: string | null;
  };
  updated_at?: string;
}

export class AppControlService {
  private cachedState: AppControlState | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_TTL_MS = 5000; // 5-second in-memory freshness guarantee

  private formatState(doc: IAppControl): AppControlState {
    return {
      user_app: {
        is_stopped: doc.user_app?.is_stopped ?? false,
        title: doc.user_app?.title || 'User App Under Maintenance',
        message:
          doc.user_app?.message ||
          'The Customer App is currently undergoing scheduled maintenance. We will be back shortly.',
        stopped_at: doc.user_app?.stopped_at ? doc.user_app.stopped_at.toISOString() : null,
        stopped_by: doc.user_app?.stopped_by || null,
      },
      partner_app: {
        is_stopped: doc.partner_app?.is_stopped ?? false,
        title: doc.partner_app?.title || 'Partner Deliveries Paused',
        message:
          doc.partner_app?.message ||
          'The Delivery Partner App is temporarily paused. Please check back shortly.',
        stopped_at: doc.partner_app?.stopped_at ? doc.partner_app.stopped_at.toISOString() : null,
        stopped_by: doc.partner_app?.stopped_by || null,
      },
      updated_at: doc.updated_at ? doc.updated_at.toISOString() : new Date().toISOString(),
    };
  }

  async getDocument(): Promise<IAppControl> {
    let doc = await AppControl.findOne({ key: 'global' });
    if (!doc) {
      doc = await AppControl.create({
        key: 'global',
        user_app: {
          is_stopped: false,
          title: 'User App Under Maintenance',
          message: 'The Customer App is currently undergoing scheduled maintenance. We will be back shortly.',
        },
        partner_app: {
          is_stopped: false,
          title: 'Partner Deliveries Paused',
          message: 'The Delivery Partner App is temporarily paused. Please check back shortly.',
        },
      });
      logger.info('Initialized default AppControl singleton document');
    }
    return doc;
  }

  async getStatus(forceRefresh = false): Promise<AppControlState> {
    const now = Date.now();
    if (!forceRefresh && this.cachedState && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.cachedState;
    }

    try {
      const doc = await this.getDocument();
      this.cachedState = this.formatState(doc);
      this.lastFetchTime = now;
      return this.cachedState;
    } catch (err: any) {
      logger.warn(`Error reading AppControl state from DB: ${err.message}`);
      if (this.cachedState) return this.cachedState;
      return {
        user_app: {
          is_stopped: false,
          title: 'User App Under Maintenance',
          message: 'The Customer App is currently undergoing maintenance.',
          stopped_at: null,
          stopped_by: null,
        },
        partner_app: {
          is_stopped: false,
          title: 'Partner Deliveries Paused',
          message: 'The Delivery Partner App is temporarily paused.',
          stopped_at: null,
          stopped_by: null,
        },
      };
    }
  }

  async isAppStopped(app: 'user' | 'partner'): Promise<boolean> {
    const status = await this.getStatus();
    return app === 'user' ? status.user_app.is_stopped : status.partner_app.is_stopped;
  }

  async getAppMaintenanceDetails(app: 'user' | 'partner') {
    const status = await this.getStatus();
    return app === 'user' ? status.user_app : status.partner_app;
  }

  async updateStatus(params: {
    app: 'user' | 'partner' | 'all';
    is_stopped: boolean;
    title?: string;
    message?: string;
    stopped_by?: string;
  }): Promise<AppControlState> {
    const doc = await this.getDocument();
    const now = new Date();

    if (params.app === 'user' || params.app === 'all') {
      doc.user_app.is_stopped = params.is_stopped;
      if (params.title !== undefined) doc.user_app.title = params.title;
      if (params.message !== undefined) doc.user_app.message = params.message;
      doc.user_app.stopped_at = params.is_stopped ? now : undefined;
      doc.user_app.stopped_by = params.is_stopped ? params.stopped_by : undefined;
    }

    if (params.app === 'partner' || params.app === 'all') {
      doc.partner_app.is_stopped = params.is_stopped;
      if (params.title !== undefined) doc.partner_app.title = params.title;
      if (params.message !== undefined) doc.partner_app.message = params.message;
      doc.partner_app.stopped_at = params.is_stopped ? now : undefined;
      doc.partner_app.stopped_by = params.is_stopped ? params.stopped_by : undefined;
    }

    doc.touch();
    await doc.save();

    this.cachedState = this.formatState(doc);
    this.lastFetchTime = Date.now();

    // Broadcast status change immediately to all connected clients via WebSocket
    wsManager.broadcastEvent('app_status_changed', this.cachedState);

    logger.info(
      `AppControl state updated by ${params.stopped_by || 'Admin'}: target=${params.app}, is_stopped=${params.is_stopped}`
    );

    return this.cachedState;
  }
}

export const appControlService = new AppControlService();
