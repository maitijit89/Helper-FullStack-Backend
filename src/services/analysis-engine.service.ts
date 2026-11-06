import { UserInterestProfile, IUserInterestProfile } from '../models/UserInterestProfile';
import { ProductEvent, IProductEvent } from '../models/ProductEvent';
import { SyncUserAnalysisInput } from '../schemas/analysis.schema';

export class AnalysisEngineService {
  /**
   * Called by the User Analysis Engine Sub-Backend to push refined
   * user interest weights, segment flags, and feed ranking instruction overrides.
   */
  async syncUserInstructions(input: SyncUserAnalysisInput): Promise<IUserInterestProfile> {
    const updatePayload: Record<string, any> = {
      $set: {
        'engineInstructions.segments': input.segments || [],
        'engineInstructions.boostCategories': input.boostCategories || [],
        'engineInstructions.suppressCategories': input.suppressCategories || [],
        'engineInstructions.preferredPriceTier': input.preferredPriceTier,
        'engineInstructions.customWeights': input.customWeights || {},
        'engineInstructions.updatedAt': new Date(),
        lastCalculatedAt: new Date(),
      },
    };

    if (input.categoryAffinities && input.categoryAffinities.length > 0) {
      updatePayload.$set.categoryAffinities = input.categoryAffinities.map((ca) => ({
        category: ca.category,
        weight: ca.weight,
        lastInteractedAt: new Date(),
      }));
    }

    if (input.tagWeights && input.tagWeights.length > 0) {
      updatePayload.$set.tagWeights = input.tagWeights.map((tw) => ({
        tag: tw.tag,
        weight: tw.weight,
      }));
    }

    const profile = await UserInterestProfile.findOneAndUpdate(
      { userId: input.userId },
      updatePayload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return profile;
  }

  /**
   * Provides training events (views, cart adds, cart removes, dwell durations)
   * to the User Analysis Engine sub-backend.
   */
  async getEventsStream(query: {
    limit?: number;
    since?: Date;
    eventType?: string;
  }): Promise<IProductEvent[]> {
    const filter: Record<string, any> = {};

    if (query.since) {
      filter.timestamp = { $gte: query.since };
    }

    if (query.eventType) {
      filter.eventType = query.eventType;
    }

    const limit = Math.min(1000, Math.max(1, query.limit || 100));

    return ProductEvent.find(filter).sort({ timestamp: -1 }).limit(limit);
  }
}

export const analysisEngineService = new AnalysisEngineService();
