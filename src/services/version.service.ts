import { env } from '../config/env';

export type PlatformType =
  | 'user_app'
  | 'partner_portal'
  | 'admin_panel'
  | 'user_analysis_engine'
  | 'product_listing_bff';

export interface PlatformVersionConfig {
  displayName: string;
  targetVersion: string;
  minSupportedVersion: string;
  releaseDate: string;
  forceUpdateBelow: string;
  downloadUrl?: string;
  changelog: string[];
}

export interface EcosystemVersionInfo {
  mainBackendVersion: string;
  projectName: string;
  environment: string;
  timestamp: string;
  platforms: Record<PlatformType, PlatformVersionConfig>;
}

export interface CompatibilityCheckResult {
  platform: PlatformType;
  clientVersion: string;
  mainBackendVersion: string;
  compatible: boolean;
  isLatest: boolean;
  updateAvailable: boolean;
  forceUpdate: boolean;
  message: string;
  downloadUrl?: string;
  changelog?: string[];
}

/**
 * Compare two semver strings: 'major.minor.patch'
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '').trim();
  const clean2 = v2.replace(/^v/, '').trim();

  const parts1 = clean1.split('.').map((n) => parseInt(n, 10) || 0);
  const parts2 = clean2.split('.').map((n) => parseInt(n, 10) || 0);

  const length = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < length; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export class VersionService {
  private mainVersion: string = env.VERSION || '1.2.1';

  /**
   * Ecosystem platform version matrix.
   * All frontend applications and sub-backends target the identical main backend version (1.2.1).
   */
  private platforms: Record<PlatformType, PlatformVersionConfig> = {
    user_app: {
      displayName: 'Helping Services (User App)',
      targetVersion: this.mainVersion,
      minSupportedVersion: '1.2.0',
      forceUpdateBelow: '1.2.0',
      releaseDate: '2026-11-07',
      downloadUrl: 'https://play.google.com/store/apps/details?id=com.helpingservices.user',
      changelog: [
        'Multi-field weighted product search with typo tolerance and dynamic facets',
        'Personalized feed ranking based on academic curriculum (UG/PG, Dept)',
        'Cart dwell time urgency boost (15-minute priority elevation)',
        'Contextual accessory recommendations and chained cross-sell bundles',
        'App and Partner rating prompt system with 2-day delay & weekly re-prompts',
      ],
    },
    partner_portal: {
      displayName: 'Helping Services Partner Portal',
      targetVersion: this.mainVersion,
      minSupportedVersion: '1.2.0',
      forceUpdateBelow: '1.2.0',
      releaseDate: '2026-11-07',
      downloadUrl: 'https://partner.helpingservices.com',
      changelog: [
        'Partner catalog fulfillment and live inventory status',
        'Partner customer rating reviews & quality analytics integration',
        'Real-time order synchronization with Main Backend v1.2.1',
      ],
    },
    admin_panel: {
      displayName: 'Admin Management Panel',
      targetVersion: this.mainVersion,
      minSupportedVersion: this.mainVersion,
      forceUpdateBelow: this.mainVersion,
      releaseDate: '2026-11-07',
      downloadUrl: 'https://admin.helpingservices.com',
      changelog: [
        'Product upload & compatible accessory linking',
        'Sub-Backend sync telemetry monitor',
        'User search analytics and aggregated rating distributions',
      ],
    },
    user_analysis_engine: {
      displayName: 'User Analysis Engine (Sub-Backend)',
      targetVersion: this.mainVersion,
      minSupportedVersion: '1.2.0',
      forceUpdateBelow: '1.2.0',
      releaseDate: '2026-11-07',
      changelog: [
        'Event stream consumer v1.2.1 compatibility',
        'Dynamic user segment & category affinity sync',
      ],
    },
    product_listing_bff: {
      displayName: 'User App Product Listing BFF (Sub-Backend)',
      targetVersion: this.mainVersion,
      minSupportedVersion: '1.2.0',
      forceUpdateBelow: '1.2.0',
      releaseDate: '2026-11-07',
      changelog: [
        'BFF edge caching aligned with Main Backend v1.2.1 product feeds',
      ],
    },
  };

  /**
   * Get the current authoritative Main Backend version
   */
  getMainBackendVersion(): string {
    return this.mainVersion;
  }

  /**
   * Get full ecosystem version status and platform specifications
   */
  getEcosystemVersionInfo(): EcosystemVersionInfo {
    return {
      mainBackendVersion: this.mainVersion,
      projectName: env.PROJECT_NAME,
      environment: env.ENVIRONMENT,
      timestamp: new Date().toISOString(),
      platforms: this.platforms,
    };
  }

  /**
   * Check client compatibility and update requirements for any app frontend or sub-backend
   */
  checkCompatibility(
    platform: PlatformType,
    clientVersion: string
  ): CompatibilityCheckResult {
    const config = this.platforms[platform];
    if (!config) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const cmpMin = compareSemver(clientVersion, config.minSupportedVersion);
    const cmpTarget = compareSemver(clientVersion, config.targetVersion);

    const forceUpdate = cmpMin < 0;
    const compatible = !forceUpdate;
    const isLatest = cmpTarget >= 0;
    const updateAvailable = cmpTarget < 0;

    let message = `App is up to date with Main Backend v${this.mainVersion}.`;
    if (forceUpdate) {
      message = `Critical update required. Client version v${clientVersion} is below minimum supported v${config.minSupportedVersion}. Please update to v${config.targetVersion} to continue.`;
    } else if (updateAvailable) {
      message = `A newer version v${config.targetVersion} is available. Current version is v${clientVersion}.`;
    }

    return {
      platform,
      clientVersion,
      mainBackendVersion: this.mainVersion,
      compatible,
      isLatest,
      updateAvailable,
      forceUpdate,
      message,
      downloadUrl: config.downloadUrl,
      changelog: updateAvailable ? config.changelog : undefined,
    };
  }
}

export const versionService = new VersionService();

