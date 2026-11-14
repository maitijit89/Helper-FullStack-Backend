import { Router, Request, Response, NextFunction } from 'express';
import { categoryService } from '../services/category.service';
import { authenticate, authorizeRole } from '../middlewares/auth';
import { createCategorySchema, updateCategorySchema } from '../schemas/category.schema';

const router = Router();

// Strict Admin role authorization
router.use(authenticate, authorizeRole('admin'));

/**
 * @route   GET /api/v1/admin/categories
 * @desc    Get all categories (including inactive)
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await categoryService.listCategories(true);
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
 * @route   POST /api/v1/admin/categories
 * @desc    Create new category
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createCategorySchema.parse(req.body);
    const category = await categoryService.createCategory(validated);

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: category,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/v1/admin/categories/:id
 * @desc    Update category
 */
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = updateCategorySchema.parse(req.body);
    const updated = await categoryService.updateCategory(req.params.id, validated);

    res.status(200).json({
      success: true,
      message: 'Category updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/admin/categories/:id
 * @desc    Deactivate category
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await categoryService.deleteCategory(req.params.id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
