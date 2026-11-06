import { Router, Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';
import { feedAlgorithmService } from '../services/feed-algorithm.service';
import { recommendationService } from '../services/recommendation.service';
import { searchAlgorithmService } from '../services/search-algorithm.service';
import { optionalAuth, authenticate } from '../middlewares/auth';
import { searchQuerySchema, suggestQuerySchema } from '../schemas/search.schema';
import { Cart } from '../models/Cart';

const router = Router();

// Support optional authentication on public product browsing and search routes
router.use(optionalAuth);

/**
 * @route   GET /api/v1/products/feed
 * @desc    Personalized product feed arranged by User Interest (Algo 1),
 *          Cart Dwell Boost (Algo 2), and Sub-Backend Analysis Engine instructions.
 */
router.get('/feed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, category } = req.query;
    const result = await feedAlgorithmService.getPersonalizedFeed(req.user?.id, {
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      category: category as string,
    });

    res.status(200).json({
      success: true,
      strategy: result.appliedStrategy,
      data: result.feed.map((f) => ({
        ...f.product.toJSON(),
        feedScore: f.score,
        rankingFactors: f.factors,
      })),
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/products/search
 * @desc    User Product Search System Algorithm:
 *          - Multi-field weighted scoring (Title, SKU, Brand, Category, Tags)
 *          - Typo tolerance / Damerau-Levenshtein fuzzy matching
 *          - Academic & Category affinity personalization (Core DB & Analytics DB)
 *          - Cart dwell time urgency boost (Algo 2 synergy)
 *          - Dynamic facet aggregation (Categories, Brands, Price range, Tags)
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedQuery = searchQuerySchema.parse(req.query);

    const searchResult = await searchAlgorithmService.search(
      validatedQuery.q,
      req.user?.id,
      {
        category: validatedQuery.category,
        brand: validatedQuery.brand,
        minPrice: validatedQuery.minPrice,
        maxPrice: validatedQuery.maxPrice,
        inStockOnly: validatedQuery.inStockOnly,
        sortBy: validatedQuery.sortBy,
        page: validatedQuery.page,
        limit: validatedQuery.limit,
      }
    );

    res.status(200).json({
      success: true,
      query: searchResult.query,
      correctedQuery: searchResult.correctedQuery,
      data: searchResult.results.map((r) => ({
        ...r.product.toJSON(),
        searchScore: r.score,
        rankingFactors: r.factors,
      })),
      facets: searchResult.facets,
      pagination: searchResult.pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/products/search/suggest
 * @desc    Autocomplete / Typeahead suggestions (Products, Categories, Brands)
 */
router.get('/search/suggest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = suggestQuerySchema.parse(req.query);
    const suggestions = await searchAlgorithmService.getSuggestions(
      validated.q,
      validated.limit
    );

    res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/products/search/trending
 * @desc    Trending and popular search keywords
 */
router.get('/search/trending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const trends = await searchAlgorithmService.getTrendingSearches(limit);

    res.status(200).json({
      success: true,
      data: trends,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/products/search/recent
 * @desc    Get user's recent search queries
 */
router.get('/search/recent', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const recent = await searchAlgorithmService.getRecentSearches(req.user!.id, limit);

    res.status(200).json({
      success: true,
      data: recent,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/products/search/recent
 * @desc    Clear user's search history
 */
router.delete('/search/recent', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await searchAlgorithmService.clearRecentSearches(req.user!.id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/products
 * @desc    Search and browse product catalog with filters
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search, minPrice, maxPrice, isFeatured, page, limit } = req.query;
    const result = await productService.listProducts({
      category: category as string,
      search: search as string,
      minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
      isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    res.status(200).json({
      success: true,
      data: result.products,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/products/:id/suggestions
 * @desc    Contextual Accessory & Chained Cross-Sell Recommendation Engine (Algo 3)
 *          (e.g., iPhone -> Charger + Cover; user adds Cover -> Chained accessories expand)
 */
router.get('/:id/suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let activeCartIds: string[] = [];
    if (req.user) {
      const cart = await Cart.findOne({ userId: req.user.id });
      if (cart) {
        activeCartIds = cart.items.map((i) => i.productId);
      }
    }

    const suggestions = await recommendationService.getProductSuggestions(
      req.params.id,
      activeCartIds
    );

    res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get single product details
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.getProductById(req.params.id, req.user?.id);
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
