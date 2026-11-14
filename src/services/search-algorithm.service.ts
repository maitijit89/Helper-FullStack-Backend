import { Product, IProduct } from '../models/Product';
import { User, IUser } from '../models/User';
import { Cart } from '../models/Cart';
import { UserInterestProfile } from '../models/UserInterestProfile';
import { SearchHistory } from '../models/SearchHistory';
import { ProductEvent } from '../models/ProductEvent';
import {
  tokenizeQuery,
  calculateSimilarity,
  findClosestTerm,
  escapeRegex,
} from '../utils/search.utils';
import { env } from '../config/env';

export interface SearchFacets {
  categories: { name: string; count: number }[];
  brands: { name: string; count: number }[];
  tags: { name: string; count: number }[];
  priceRange: { min: number; max: number };
}

export interface ScoredSearchResult {
  product: IProduct;
  score: number;
  factors: {
    relevanceScore: number;
    personalizationBoost: number;
    businessBoost: number;
    matchedTerms: string[];
  };
}

export interface SearchResponse {
  query: string;
  correctedQuery?: string;
  results: ScoredSearchResult[];
  facets: SearchFacets;
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
}

export interface SuggestionResponse {
  query: string;
  products: { id: string; title: string; category: string; price: number; image?: string }[];
  categories: string[];
  brands: string[];
}

export class SearchAlgorithmService {
  /**
   * Main Product Search Algorithm:
   * 1. Multi-Field Weighted Matching (Title, SKU, Brand, Category, Tags, Description)
   * 2. Typo Tolerance & Damerau-Levenshtein Fuzzy Matching
   * 3. Personalization & Academic Alignment (Core DB)
   * 4. Cart Dwell Time Urgency Boost (Analytics DB)
   * 5. Dynamic Facet Aggregation & Sorting
   */
  async search(
    rawQuery: string,
    userId?: string,
    options: {
      category?: string;
      brand?: string;
      minPrice?: number;
      maxPrice?: number;
      inStockOnly?: boolean;
      sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'popular' | 'newest';
      page?: number;
      limit?: number;
    } = {}
  ): Promise<SearchResponse> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const normalizedInput = rawQuery.trim().toLowerCase();
    const queryTokens = tokenizeQuery(normalizedInput);

    // 1. Fetch Candidate Products from Catalog DB with primary filters
    const filter: Record<string, any> = { isDeleted: false, isActive: true };

    if (typeof options.category === 'string' && options.category.trim()) {
      filter.category = new RegExp(`^${escapeRegex(options.category.trim())}$`, 'i');
    }
    if (typeof options.brand === 'string' && options.brand.trim()) {
      filter.brand = new RegExp(`^${escapeRegex(options.brand.trim())}$`, 'i');
    }
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      filter.price = {};
      if (options.minPrice !== undefined) filter.price.$gte = options.minPrice;
      if (options.maxPrice !== undefined) filter.price.$lte = options.maxPrice;
    }
    if (options.inStockOnly) {
      filter.stock = { $gt: 0 };
    }

    const candidateProducts: IProduct[] = await Product.find(filter);

    // 2. Build Vocabulary Dictionary for Spell-Check / Typo Correction
    const vocabulary = new Set<string>();
    for (const p of candidateProducts) {
      p.title.toLowerCase().split(/\s+/).forEach((w) => vocabulary.add(w.replace(/[^a-z0-9]/g, '')));
      if (p.brand) vocabulary.add(p.brand.toLowerCase());
      vocabulary.add(p.category.toLowerCase());
      (p.tags || []).forEach((t) => vocabulary.add(t.toLowerCase()));
    }
    const dictionary = Array.from(vocabulary).filter((w) => w.length > 2);

    // 3. Typo Correction & Fuzzy Alignment
    const correctedTokens: string[] = [];
    let hasTypoCorrection = false;

    for (const token of queryTokens) {
      if (vocabulary.has(token)) {
        correctedTokens.push(token);
      } else {
        const closest = findClosestTerm(token, dictionary, 2);
        if (closest && closest !== token) {
          correctedTokens.push(closest);
          hasTypoCorrection = true;
        } else {
          correctedTokens.push(token);
        }
      }
    }

    const effectiveTokens = Array.from(new Set([...queryTokens, ...correctedTokens]));
    const correctedQuery = hasTypoCorrection ? correctedTokens.join(' ') : undefined;

    // 4. Fetch User Personalization Context (Core DB & Analytics DB)
    let user: IUser | null = null;
    let dwellingCategories = new Set<string>();
    let categoryAffinities = new Map<string, number>();

    if (userId) {
      user = await User.findById(userId);

      const cart = await Cart.findOne({ userId });
      if (cart && cart.items.length > 0) {
        const now = Date.now();
        const thresholdMins = env.CART_DWELL_BOOST_MINUTES || 15;
        for (const item of cart.items) {
          const dwell = Math.floor((now - new Date(item.addedAt).getTime()) / 60000);
          if (dwell >= thresholdMins) {
            dwellingCategories.add(item.category.toLowerCase());
          }
        }
      }

      const profile = await UserInterestProfile.findOne({ userId });
      if (profile) {
        profile.categoryAffinities.forEach((ca) =>
          categoryAffinities.set(ca.category.toLowerCase(), ca.weight)
        );
      }
    }

    // 5. Score Candidates using Multi-Field Weighted Relevance + Personalization
    const scoredCandidates: ScoredSearchResult[] = [];

    for (const p of candidateProducts) {
      let relevanceScore = 0;
      let personalizationBoost = 0;
      let businessBoost = 0;
      const matchedTerms = new Set<string>();

      const titleLower = p.title.toLowerCase();
      const brandLower = (p.brand || '').toLowerCase();
      const catLower = p.category.toLowerCase();
      const subCatLower = (p.subCategory || '').toLowerCase();
      const skuLower = p.sku.toLowerCase();
      const descLower = p.description.toLowerCase();
      const tagsLower = (p.tags || []).map((t) => t.toLowerCase());

      // Exact SKU full match
      if (normalizedInput === skuLower) {
        relevanceScore += 50.0;
        matchedTerms.add(p.sku);
      }

      // Token-level scoring
      for (const token of effectiveTokens) {
        // Title Field (Weight = 10.0 exact, 5.0 prefix, 3.0 substring)
        if (titleLower.includes(token)) {
          const words = titleLower.split(/\s+/);
          if (words.includes(token)) {
            relevanceScore += 10.0;
          } else if (words.some((w) => w.startsWith(token))) {
            relevanceScore += 5.0;
          } else {
            relevanceScore += 3.0;
          }
          matchedTerms.add(token);
        } else {
          // Fuzzy word similarity in title
          const words = titleLower.split(/\s+/);
          for (const w of words) {
            const sim = calculateSimilarity(token, w);
            if (sim >= 0.75) {
              relevanceScore += sim * 6.0;
              matchedTerms.add(w);
              break;
            }
          }
        }

        // Brand Match (Weight = 8.0)
        if (brandLower && (brandLower === token || brandLower.includes(token))) {
          relevanceScore += 8.0;
          matchedTerms.add(p.brand!);
        }

        // Category & SubCategory Match (Weight = 7.0)
        if (catLower === token || catLower.includes(token) || subCatLower.includes(token)) {
          relevanceScore += 7.0;
          matchedTerms.add(p.category);
        }

        // Tags Match (Weight = 5.0)
        if (tagsLower.some((t) => t === token || t.includes(token))) {
          relevanceScore += 5.0;
          matchedTerms.add(token);
        }

        // Description Substring (Weight = 1.5)
        if (descLower.includes(token)) {
          relevanceScore += 1.5;
        }
      }

      // If no relevance was established, discard product from search results
      if (relevanceScore <= 0) {
        continue;
      }

      // Personalization Factors (Core DB & Analytics DB)
      if (user) {
        if (user.course && p.targetCourses && p.targetCourses.includes(user.course)) {
          personalizationBoost += 10.0;
        }
        if (
          user.department &&
          p.targetDepartments &&
          p.targetDepartments.some(
            (d) => d.toLowerCase() === user.department?.toLowerCase()
          )
        ) {
          personalizationBoost += 10.0;
        }

        // Category Affinity Boost
        const affinity = categoryAffinities.get(catLower) || 0;
        personalizationBoost += Math.min(15.0, affinity * 0.3);

        // Cart Dwell Intent Boost (Algorithm 2 synergy)
        if (dwellingCategories.has(catLower)) {
          personalizationBoost += 25.0; // Elevate products matching categories user has dwelling in cart!
        }
      }

      // Business & Quality Boosts
      if (p.stock > 0) {
        businessBoost += 10.0;
      } else {
        businessBoost -= 15.0; // De-prioritize out-of-stock items
      }

      businessBoost += Math.min(10.0, (p.salesCount || 0) * 1.2 + (p.viewCount || 0) * 0.05);
      if (p.isFeatured) businessBoost += 5.0;

      const totalScore = relevanceScore + personalizationBoost + businessBoost;

      scoredCandidates.push({
        product: p,
        score: Math.round(totalScore * 10) / 10,
        factors: {
          relevanceScore: Math.round(relevanceScore * 10) / 10,
          personalizationBoost: Math.round(personalizationBoost * 10) / 10,
          businessBoost: Math.round(businessBoost * 10) / 10,
          matchedTerms: Array.from(matchedTerms),
        },
      });
    }

    // 6. Dynamic Facet Extraction across all matching products
    const facetCategories = new Map<string, number>();
    const facetBrands = new Map<string, number>();
    const facetTags = new Map<string, number>();
    let minPrice = Infinity;
    let maxPrice = 0;

    for (const item of scoredCandidates) {
      const p = item.product;
      const effectivePrice = p.discountPrice ?? p.price;

      if (effectivePrice < minPrice) minPrice = effectivePrice;
      if (effectivePrice > maxPrice) maxPrice = effectivePrice;

      facetCategories.set(p.category, (facetCategories.get(p.category) || 0) + 1);
      if (p.brand) {
        facetBrands.set(p.brand, (facetBrands.get(p.brand) || 0) + 1);
      }
      for (const t of p.tags || []) {
        facetTags.set(t, (facetTags.get(t) || 0) + 1);
      }
    }

    const facets: SearchFacets = {
      categories: Array.from(facetCategories.entries()).map(([name, count]) => ({ name, count })),
      brands: Array.from(facetBrands.entries()).map(([name, count]) => ({ name, count })),
      tags: Array.from(facetTags.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([name, count]) => ({ name, count })),
      priceRange: {
        min: minPrice === Infinity ? 0 : minPrice,
        max: maxPrice,
      },
    };

    // 7. Apply Requested Sorting
    const sortBy = options.sortBy || 'relevance';
    switch (sortBy) {
      case 'price_asc':
        scoredCandidates.sort((a, b) => (a.product.discountPrice ?? a.product.price) - (b.product.discountPrice ?? b.product.price));
        break;
      case 'price_desc':
        scoredCandidates.sort((a, b) => (b.product.discountPrice ?? b.product.price) - (a.product.discountPrice ?? a.product.price));
        break;
      case 'popular':
        scoredCandidates.sort((a, b) => (b.product.salesCount || 0) - (a.product.salesCount || 0));
        break;
      case 'newest':
        scoredCandidates.sort((a, b) => new Date(b.product.createdAt).getTime() - new Date(a.product.createdAt).getTime());
        break;
      case 'relevance':
      default:
        scoredCandidates.sort((a, b) => b.score - a.score);
        break;
    }

    // 8. Paginate Results
    const paginated = scoredCandidates.slice((page - 1) * limit, page * limit);

    // 9. Asynchronously Log Search Analytics in Analytics DB
    SearchHistory.create({
      userId,
      query: rawQuery,
      normalizedQuery: normalizedInput,
      resultCount: scoredCandidates.length,
      filters: options,
      timestamp: new Date(),
    }).catch(() => {});

    if (userId) {
      ProductEvent.create({
        userId,
        productId: paginated[0]?.product._id.toString() || 'search',
        category: options.category || 'all',
        eventType: 'view',
        metadata: { search: rawQuery, resultCount: scoredCandidates.length },
      }).catch(() => {});
    }

    return {
      query: rawQuery,
      correctedQuery,
      results: paginated,
      facets,
      pagination: {
        total: scoredCandidates.length,
        page,
        totalPages: Math.ceil(scoredCandidates.length / limit),
      },
    };
  }

  /**
   * Autocomplete / Typeahead Suggestion Engine
   */
  async getSuggestions(prefix: string, limit: number = 8): Promise<SuggestionResponse> {
    const trimmed = prefix.trim();
    if (!trimmed) {
      return { query: prefix, products: [], categories: [], brands: [] };
    }

    const escaped = escapeRegex(trimmed);
    const regex = new RegExp(`^${escaped}`, 'i');
    const anywhereRegex = new RegExp(escaped, 'i');

    const [matchedProducts, matchedCategories, matchedBrands] = await Promise.all([
      Product.find({
        $or: [{ title: anywhereRegex }, { tags: regex }],
        isDeleted: false,
        isActive: true,
      })
        .select('_id title category price discountPrice images')
        .sort({ salesCount: -1, viewCount: -1 })
        .limit(limit),

      Product.distinct('category', { category: anywhereRegex, isDeleted: false, isActive: true }),
      Product.distinct('brand', { brand: anywhereRegex, isDeleted: false, isActive: true }),
    ]);

    return {
      query: prefix,
      products: matchedProducts.map((p) => ({
        id: p._id.toString(),
        title: p.title,
        category: p.category,
        price: p.discountPrice ?? p.price,
        image: p.images?.[0],
      })),
      categories: (matchedCategories as string[]).slice(0, 4),
      brands: (matchedBrands as string[]).filter(Boolean).slice(0, 4),
    };
  }

  /**
   * Get trending search queries across all users
   */
  async getTrendingSearches(limit: number = 10): Promise<{ query: string; count: number }[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trends = await SearchHistory.aggregate([
      { $match: { timestamp: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$normalizedQuery', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, query: '$_id', count: 1 } },
    ]);

    return trends;
  }

  /**
   * Get recent search queries for a specific user
   */
  async getRecentSearches(userId: string, limit: number = 10): Promise<string[]> {
    const recent = await SearchHistory.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit * 2);

    const uniqueQueries: string[] = [];
    const seen = new Set<string>();

    for (const item of recent) {
      if (!seen.has(item.query.toLowerCase())) {
        seen.add(item.query.toLowerCase());
        uniqueQueries.push(item.query);
        if (uniqueQueries.length >= limit) break;
      }
    }

    return uniqueQueries;
  }

  /**
   * Clear search history for a user
   */
  async clearRecentSearches(userId: string): Promise<{ message: string }> {
    await SearchHistory.deleteMany({ userId });
    return { message: 'Search history cleared successfully.' };
  }
}

export const searchAlgorithmService = new SearchAlgorithmService();
