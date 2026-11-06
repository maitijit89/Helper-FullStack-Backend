import { Router, Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';
import { authenticate, authorizeRole } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import {
  createProductSchema,
  updateProductSchema,
  linkAccessoriesSchema,
} from '../schemas/product.schema';

const router = Router();

// Secure admin product routes
router.use(authenticate, authorizeRole('admin'));

/**
 * @route   POST /api/v1/admin/products
 * @desc    Upload / create a product from the Admin Panel
 */
router.post(
  '/',
  validateBody(createProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productService.createProduct(req.body);
      res.status(201).json({
        success: true,
        message: 'Product created successfully.',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/admin/products
 * @desc    List products with administrative filters & pagination
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
 * @route   GET /api/v1/admin/products/:id
 * @desc    Get product details by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await productService.getProductById(req.params.id);
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/v1/admin/products/:id
 * @desc    Update product details
 */
router.patch(
  '/:id',
  validateBody(updateProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await productService.updateProduct(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Product updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/v1/admin/products/:id
 * @desc    Delete (soft-delete) product
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await productService.deleteProduct(req.params.id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/admin/products/:id/accessories
 * @desc    Link compatible accessories (essential, recommended, add-on) to a product
 */
router.post(
  '/:id/accessories',
  validateBody(linkAccessoriesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await productService.linkAccessories(req.params.id, req.body.accessories);
      res.status(200).json({
        success: true,
        message: 'Compatible accessories linked successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
