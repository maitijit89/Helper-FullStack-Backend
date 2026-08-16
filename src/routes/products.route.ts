import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { CreateProductSchema, UpdateProductSchema } from '../schemas/product.schema';
import { Product, ProductCategory } from '../models/Product';
import { memoryUpload } from '../middlewares/upload';
import { s3Service } from '../services/s3.service';
import { NotFoundException } from '../middlewares/errorHandler';

const router = Router();

// Public: List products with search, category filtering and availability
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search, available_only, limit = 50, skip = 0 } = req.query;
    const filter: any = {};

    if (category && Object.values(ProductCategory).includes(category as ProductCategory)) {
      filter.category = category;
    }

    if (available_only === 'true') {
      filter.is_available = true;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
        { search_keywords: searchRegex },
      ];
    }

    const products = await Product.find(filter)
      .sort({ created_at: -1 })
      .skip(Number(skip))
      .limit(Number(limit));

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      total,
      data: products,
    });
  } catch (err) {
    next(err);
  }
});

// Public: Get single product
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Create product
router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(CreateProductSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const product = new Product(req.body);
      await product.save();

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: product,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Admin: Update product
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  validate(UpdateProductSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        throw new NotFoundException('Product not found');
      }

      Object.assign(product, req.body);
      product.touch();
      await product.save();

      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: product,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Admin: Delete product
router.delete('/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// Admin: Upload product image
router.post(
  '/:id/upload-image',
  authenticate,
  requireAdmin,
  memoryUpload.single('image'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        throw new NotFoundException('Product not found');
      }

      if (!req.file) {
        res.status(400).json({ success: false, detail: 'No image file uploaded' });
        return;
      }

      const imageUrl = await s3Service.uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      product.image_url = imageUrl;
      product.touch();
      await product.save();

      res.status(200).json({
        success: true,
        message: 'Product image uploaded successfully',
        data: product,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
