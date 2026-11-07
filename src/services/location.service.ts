import axios from 'axios';
import { UserLocation, IUserLocation } from '../models/UserLocation';
import { User, IUser } from '../models/User';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { UpdateLocationInput } from '../schemas/location.schema';

export interface LocationStreamEvent {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: 'user' | 'partner' | 'admin';
  collegeName?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  batteryLevel?: number;
  isMocked: boolean;
  activity?: string;
  address?: string;
  timestamp: Date;
}

export interface LiveLocationItem {
  userId: string;
  userName: string;
  userEmail: string;
  role: 'user' | 'partner' | 'admin';
  collegeName?: string;
  mobile?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  isMocked: boolean;
  timestamp: Date;
  ageSeconds: number;
}

export class LocationService {
  /**
   * Sliding in-memory buffer holding recent location telemetry events.
   * Enables immediate, low-latency streaming and polling for the Admin Sub-Backend.
   */
  private recentEvents: LocationStreamEvent[] = [];
  private readonly maxBufferSize = 1000;

  /**
   * Record real-time user location ping:
   * 1. Persist telemetry document in Analytics DB (UserLocation)
   * 2. Update user.lastLocation in Core DB (User)
   * 3. Forward real-time location event to Admin Sub-Backend
   */
  async recordUserLocation(
    userId: string,
    input: UpdateLocationInput
  ): Promise<{
    location: IUserLocation;
    forwardedToAdminSubBackend: boolean;
  }> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      throw new Error('User not found or inactive');
    }

    const timestamp = new Date();

    // 1. Create telemetry record in Analytics DB with GeoJSON Point
    const locationDoc = await UserLocation.create({
      userId,
      role: user.role,
      location: {
        type: 'Point',
        coordinates: [input.longitude, input.latitude],
      },
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      altitude: input.altitude,
      speed: input.speed,
      heading: input.heading,
      batteryLevel: input.batteryLevel,
      isMocked: input.isMocked || false,
      activity: input.activity,
      address: input.address,
      timestamp,
    });

    // 2. Update lastLocation snapshot on the User document in Core DB
    user.lastLocation = {
      type: 'Point',
      coordinates: [input.longitude, input.latitude],
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      updatedAt: timestamp,
    };
    await user.save();

    // 3. Assemble streaming payload for Admin Sub-Backend
    const streamEvent: LocationStreamEvent = {
      id: locationDoc._id.toString(),
      userId: user._id.toString(),
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      collegeName: user.collegeName,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      speed: input.speed,
      heading: input.heading,
      altitude: input.altitude,
      batteryLevel: input.batteryLevel,
      isMocked: input.isMocked || false,
      activity: input.activity,
      address: input.address,
      timestamp,
    };

    // Buffer in memory for fast stream delivery
    this.bufferEvent(streamEvent);

    // Asynchronously dispatch event to Admin Sub-Backend HTTP webhook
    const forwarded = await this.dispatchToAdminSubBackend(streamEvent);

    return {
      location: locationDoc,
      forwardedToAdminSubBackend: forwarded,
    };
  }

  /**
   * Dispatch location event to external Admin Sub-Backend via HTTP POST webhook
   */
  async dispatchToAdminSubBackend(event: LocationStreamEvent): Promise<boolean> {
    const url = env.ADMIN_SUB_BACKEND_URL;
    if (!url) {
      // In dev or test mode when admin sub-backend URL is not set, buffer in memory
      return false;
    }

    try {
      await axios.post(
        `${url.replace(/\/+$/, '')}/api/v1/internal/locations/stream`,
        event,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-engine-secret': env.ADMIN_SUB_BACKEND_SECRET,
          },
          timeout: 3000,
        }
      );
      return true;
    } catch (err: any) {
      logger.warn(
        `Failed to forward location event to Admin Sub-Backend at ${url}: ${err.message}`
      );
      return false;
    }
  }

  /**
   * In-memory event buffer management (sliding window)
   */
  private bufferEvent(event: LocationStreamEvent): void {
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > this.maxBufferSize) {
      this.recentEvents.pop();
    }
  }

  /**
   * Get recent location event stream for Admin Sub-Backend consumer
   */
  getBufferedEventStream(options: {
    limit?: number;
    since?: Date;
    role?: string;
  } = {}): LocationStreamEvent[] {
    const limit = Math.min(500, Math.max(1, options.limit || 100));
    let filtered = this.recentEvents;

    if (options.since) {
      const sinceTime = options.since.getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= sinceTime);
    }

    if (options.role) {
      filtered = filtered.filter((e) => e.role === options.role);
    }

    return filtered.slice(0, limit);
  }

  /**
   * Get real-time live locations of all active users within maxAgeMinutes
   */
  async getLiveLocations(options: {
    maxAgeMinutes?: number;
    role?: string;
    limit?: number;
  } = {}): Promise<LiveLocationItem[]> {
    const maxAgeMinutes = options.maxAgeMinutes || 15;
    const limit = options.limit || 100;
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    const matchStage: Record<string, any> = {
      timestamp: { $gte: cutoff },
    };
    if (options.role) {
      matchStage.role = options.role;
    }

    // Aggregate latest location per user
    const latestPings = await UserLocation.aggregate([
      { $match: matchStage },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$userId',
          latestDoc: { $first: '$$ROOT' },
        },
      },
      { $limit: limit },
    ]);

    if (latestPings.length === 0) {
      return [];
    }

    const userIds = latestPings.map((p) => p._id);
    const users = await User.find({ _id: { $in: userIds } }).select(
      '_id name email mobile role collegeName'
    );
    const userMap = new Map<string, IUser>();
    users.forEach((u) => userMap.set(u._id.toString(), u));

    const now = Date.now();
    const liveItems: LiveLocationItem[] = latestPings.map((p) => {
      const doc: IUserLocation = p.latestDoc;
      const u = userMap.get(doc.userId);
      const pingTime = new Date(doc.timestamp).getTime();

      return {
        userId: doc.userId,
        userName: u?.name || 'Unknown User',
        userEmail: u?.email || '',
        role: doc.role,
        collegeName: u?.collegeName,
        mobile: u?.mobile,
        latitude: doc.latitude,
        longitude: doc.longitude,
        accuracy: doc.accuracy,
        speed: doc.speed,
        heading: doc.heading,
        batteryLevel: doc.batteryLevel,
        isMocked: doc.isMocked || false,
        timestamp: doc.timestamp,
        ageSeconds: Math.floor((now - pingTime) / 1000),
      };
    });

    return liveItems;
  }

  /**
   * Retrieve historical breadcrumb trajectory for a specific user
   */
  async getUserLocationHistory(
    userId: string,
    options: { since?: Date; limit?: number } = {}
  ): Promise<IUserLocation[]> {
    const limit = Math.min(500, Math.max(1, options.limit || 100));
    const filter: Record<string, any> = { userId };

    if (options.since) {
      filter.timestamp = { $gte: options.since };
    }

    const history = await UserLocation.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit);

    return history;
  }

  /**
   * Geospatial query: Find active users within a given radius using MongoDB 2dsphere index
   */
  async getNearbyUsers(params: {
    latitude: number;
    longitude: number;
    radiusMeters?: number;
    role?: string;
    limit?: number;
  }): Promise<{
    total: number;
    results: (IUserLocation & { distanceMeters?: number })[];
  }> {
    const radiusMeters = params.radiusMeters || 5000;
    const limit = Math.min(200, Math.max(1, params.limit || 50));

    const geoQuery: Record<string, any> = {
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [params.longitude, params.latitude],
          },
          $maxDistance: radiusMeters,
        },
      },
    };

    if (params.role) {
      geoQuery.role = params.role;
    }

    const locations = await UserLocation.find(geoQuery).limit(limit);

    return {
      total: locations.length,
      results: locations,
    };
  }
}

export const locationService = new LocationService();

