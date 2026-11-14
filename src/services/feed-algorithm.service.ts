import { Product, IProduct } from '../models/Product';
import { User, IUser } from '../models/User';
import { Cart } from '../models/Cart';
import { UserInterestProfile } from '../models/UserInterestProfile';
import { env } from '../config/env';
import { escapeRegex } from '../utils/search.utils';

export interface ScoredProduct {
  product: IProduct;
  score: number;
  factors: {
    baseScore: number;
    academicMatch: number;
    interestMatch: number;
    cartDwellBoost: number;
    engineBoost: number;
    popularityBoost: number;
  };
}

export class FeedAlgorithmService {
  /**
   * Generates a personalized product feed for a user, combining:
   * 1. User Interest Affinities & Academic Profile (Course UG/PG, Department)
   * 2. Cart Dwell Time Intent Boost (elevates products/categories dwelling in cart for some time)
   * 3. Sub-Backend User Analysis Engine instructions (boosts/suppressions)
   */
  async getPersonalizedFeed(
    userId?: string,
    query: { page?: number; limit?: number; category?: string } = {}
  ): Promise<{
    feed: ScoredProduct[];
    total: number;
    page: number;
    totalPages: number;
    appliedStrategy: string;
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    const filter: Record<string, any> = { isDeleted: false, isActive: true };
    if (typeof query.category === 'string' && query.category.trim()) {
      filter.category = new RegExp(`^${escapeRegex(query.category.trim())}$`, 'i');
    }

    const candidateProducts: IProduct[] = await Product.find(filter);

    if (candidateProducts.length === 0) {
      return {
        feed: [],
        total: 0,
        page,
        totalPages: 0,
        appliedStrategy: 'empty',
      };
    }

    // If unauthenticated / guest user, return standard popularity & featured ranking
    if (!userId) {
      const guestScored: ScoredProduct[] = candidateProducts.map((p) => {
        const popularityBoost = Math.min(20, (p.salesCount || 0) * 2 + (p.viewCount || 0) * 0.1);
        const featuredBoost = p.isFeatured ? 15 : 0;
        const total = 10 + popularityBoost + featuredBoost;

        return {
          product: p,
          score: Math.round(total * 10) / 10,
          factors: {
            baseScore: 10,
            academicMatch: 0,
            interestMatch: 0,
            cartDwellBoost: 0,
            engineBoost: featuredBoost,
            popularityBoost: Math.round(popularityBoost * 10) / 10,
          },
        };
      });

      guestScored.sort((a, b) => b.score - a.score);
      const paginated = guestScored.slice((page - 1) * limit, page * limit);

      return {
        feed: paginated,
        total: guestScored.length,
        page,
        totalPages: Math.ceil(guestScored.length / limit),
        appliedStrategy: 'guest_trending_featured',
      };
    }

    // 1. Fetch User Academic Context from Core DB
    const user: IUser | null = await User.findById(userId);

    // 2. Fetch User Cart with Dwell Times from Analytics DB
    const cart = await Cart.findOne({ userId });
    const now = Date.now();
    const dwellThresholdMinutes = env.CART_DWELL_BOOST_MINUTES || 15;

    // Track cart product IDs, category dwell times, and accessory IDs
    const cartProductIds = new Set<string>();
    const categoryMaxDwell = new Map<string, number>();

    if (cart && cart.items.length > 0) {
      for (const item of cart.items) {
        cartProductIds.add(item.productId);
        const dwellMins = Math.max(0, Math.floor((now - new Date(item.addedAt).getTime()) / 60000));
        const currentMax = categoryMaxDwell.get(item.category) || 0;
        if (dwellMins > currentMax) {
          categoryMaxDwell.set(item.category, dwellMins);
        }
      }
    }

    // 3. Fetch User Interest Profile & Analysis Engine Instructions from Analytics DB
    const profile = await UserInterestProfile.findOne({ userId });
    const categoryAffinities = new Map<string, number>();
    const tagWeights = new Map<string, number>();

    if (profile) {
      profile.categoryAffinities.forEach((ca) => categoryAffinities.set(ca.category.toLowerCase(), ca.weight));
      profile.tagWeights.forEach((tw) => tagWeights.set(tw.tag.toLowerCase(), tw.weight));
    }

    const engineInstructions = profile?.engineInstructions;
    const boostCategories = new Set(
      (engineInstructions?.boostCategories || []).map((c) => c.toLowerCase())
    );
    const suppressCategories = new Set(
      (engineInstructions?.suppressCategories || []).map((c) => c.toLowerCase())
    );

    // 4. Score each candidate product using the multi-factor algorithmic formulation
    const scoredList: ScoredProduct[] = candidateProducts.map((p) => {
      let academicMatch = 0;
      let interestMatch = 0;
      let cartDwellBoost = 0;
      let engineBoost = 0;
      let popularityBoost = 0;

      const pCategoryLower = p.category.toLowerCase();
      const pIdStr = p._id.toString();

      // Factor 1: Academic Profile Match (Course UG/PG & Department from Core DB)
      if (user) {
        if (user.course && p.targetCourses && p.targetCourses.includes(user.course)) {
          academicMatch += 15;
        }
        if (
          user.department &&
          p.targetDepartments &&
          p.targetDepartments.some(
            (dept) => dept.toLowerCase() === user.department?.toLowerCase()
          )
        ) {
          academicMatch += 15;
        }
      }

      // Factor 2: User Interest & Behavior Profile Match
      const catAffinity = categoryAffinities.get(pCategoryLower) || 0;
      interestMatch += Math.min(30, catAffinity * 0.6);

      if (p.tags && p.tags.length > 0) {
        let tagScore = 0;
        for (const tag of p.tags) {
          const w = tagWeights.get(tag.toLowerCase()) || 0;
          tagScore += w;
        }
        interestMatch += Math.min(15, tagScore);
      }

      // Factor 3: Cart Dwell Time Intent Boost (Algorithm 2)
      // "if any product user add cart for some time then this type of product show first"
      const catDwell = categoryMaxDwell.get(p.category) || 0;
      if (cartProductIds.has(pIdStr)) {
        // Exact product currently dwelling in cart -> high urgency boost
        cartDwellBoost += 40;
      } else if (catDwell >= dwellThresholdMinutes) {
        // Related product in the same category where user has item dwelling in cart
        // Logarithmic scale: 20 base boost + up to 25 extra points based on dwell duration
        const dynamicDwell = Math.min(25, Math.log2(1 + catDwell / dwellThresholdMinutes) * 10);
        cartDwellBoost += 25 + dynamicDwell;
      }

      // Factor 4: Sub-Backend Analysis Engine Instructions
      if (boostCategories.has(pCategoryLower)) {
        engineBoost += 30;
      }
      if (suppressCategories.has(pCategoryLower)) {
        engineBoost -= 50;
      }
      if (engineInstructions?.customWeights && engineInstructions.customWeights[p.category]) {
        engineBoost += engineInstructions.customWeights[p.category];
      }

      // Factor 5: Popularity & Freshness
      popularityBoost += Math.min(10, (p.salesCount || 0) * 1.5 + (p.viewCount || 0) * 0.1);
      if (p.isFeatured) popularityBoost += 10;

      const totalScore =
        10 + academicMatch + interestMatch + cartDwellBoost + engineBoost + popularityBoost;

      return {
        product: p,
        score: Math.round(totalScore * 10) / 10,
        factors: {
          baseScore: 10,
          academicMatch: Math.round(academicMatch * 10) / 10,
          interestMatch: Math.round(interestMatch * 10) / 10,
          cartDwellBoost: Math.round(cartDwellBoost * 10) / 10,
          engineBoost: Math.round(engineBoost * 10) / 10,
          popularityBoost: Math.round(popularityBoost * 10) / 10,
        },
      };
    });

    // 5. Rank products descending by score
    scoredList.sort((a, b) => b.score - a.score);

    const paginated = scoredList.slice((page - 1) * limit, page * limit);

    return {
      feed: paginated,
      total: scoredList.length,
      page,
      totalPages: Math.ceil(scoredList.length / limit),
      appliedStrategy: 'personalized_interest_cart_dwell',
    };
  }
}

export const feedAlgorithmService = new FeedAlgorithmService();
