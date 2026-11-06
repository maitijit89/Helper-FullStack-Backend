import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

class GeoService {
  /**
   * Calculates Haversine distance between two coordinates in kilometers.
   */
  calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(coord2.latitude - coord1.latitude);
    const dLon = this.toRadians(coord2.longitude - coord1.longitude);

    const lat1 = this.toRadians(coord1.latitude);
    const lat2 = this.toRadians(coord2.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return +(R * c).toFixed(3);
  }

  /**
   * Calculates spatial bounding box coordinates around a center point for a given radius in km.
   * Enables MongoDB to use B-tree coordinate indexes to prune 99% of documents before spherical distance calculations.
   */
  getBoundingBox(center: Coordinates, radiusKm: number): BoundingBox {
    const latDelta = radiusKm / 111.0;
    const latRad = (center.latitude * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const lngDelta = radiusKm / (111.0 * (Math.abs(cosLat) > 0.0001 ? Math.abs(cosLat) : 1.0));

    return {
      minLat: center.latitude - latDelta,
      maxLat: center.latitude + latDelta,
      minLng: center.longitude - lngDelta,
      maxLng: center.longitude + lngDelta,
    };
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Get routing distance or geocoding from Mappls REST API (if key is set).
   */
  async getMapplsGeocode(address: string): Promise<Coordinates | null> {
    if (!env.MAPPLS_REST_API_KEY) {
      return null;
    }
    try {
      const response = await axios.get('https://atlas.mappls.com/api/places/geocode', {
        params: { address },
        headers: { Authorization: `Bearer ${env.MAPPLS_REST_API_KEY}` },
        timeout: 5000,
      });
      const data = response.data?.copResults?.[0] || response.data?.results?.[0];
      if (data && data.latitude && data.longitude) {
        return {
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
        };
      }
    } catch (err: any) {
      logger.warn(`Mappls geocode lookup failed: ${err.message}`);
    }
    return null;
  }
}

export const geoService = new GeoService();
