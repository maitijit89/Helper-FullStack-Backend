import { Router, Request, Response, NextFunction } from 'express';
import { categoryService } from '../services/category.service';

const router = Router();

/**
 * @route   GET /api/v1/categories
 * @desc    Get all active product categories with product counts and accessory categories
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await categoryService.listCategories(false);
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/categories/:slug
 * @desc    Get category details by slug
 */
router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await categoryService.getCategoryBySlug(req.params.slug);
    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
