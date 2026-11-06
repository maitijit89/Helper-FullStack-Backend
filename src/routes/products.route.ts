import path from 'path';
import fs from 'fs';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { CreateProductSchema, UpdateProductSchema } from '../schemas/product.schema';
import { Product, ProductCategory, formatPublicImageUrl } from '../models/Product';
import { memoryUpload } from '../middlewares/upload';
import { s3Service } from '../services/s3.service';
import { redisService } from '../services/redis.service';
import { NotFoundException } from '../middlewares/errorHandler';

const router = Router();

// Public: List products with caching, search, category filtering and availability
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search, available_only, limit = 50, skip = 0 } = req.query;

    const cacheKey = `products:list:${category || 'all'}:${search || 'none'}:${available_only || 'false'}:${limit}:${skip}`;
    const cachedData = await redisService.get(cacheKey);

    if (cachedData) {
      return res.status(200).json(JSON.parse(cachedData));
    }

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

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ created_at: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean(),
      Product.countDocuments(filter),
    ]);

    const formattedProducts = products.map((p: any) => ({
      ...p,
      image_url: formatPublicImageUrl(p.image_url),
    }));

    const responsePayload = {
      success: true,
      total,
      data: formattedProducts,
    };

    // Cache product lists for 3 minutes (180s)
    await redisService.set(cacheKey, JSON.stringify(responsePayload), 180);

    res.status(200).json(responsePayload);
  } catch (err) {
    next(err);
  }
});

// Public: Get single product with lean execution
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = `products:single:${req.params.id}`;
    const cached = await redisService.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const payload = {
      success: true,
      data: {
        ...product,
        image_url: formatPublicImageUrl(product.image_url),
      },
    };

    await redisService.set(cacheKey, JSON.stringify(payload), 300);

    res.status(200).json(payload);
  } catch (err) {
    next(err);
  }
});

// Public: Direct public link to view product image
router.get('/:id/image', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product || !product.image_url) {
      throw new NotFoundException('Product image not found');
    }

    const publicUrl = formatPublicImageUrl(product.image_url) || product.image_url;

    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h

    // If already a full URL (S3, Google CDN, external CDN), redirect directly
    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
      return res.redirect(302, publicUrl);
    }

    // If local static path, stream file or redirect
    if (publicUrl.startsWith('/static/')) {
      const localRelPath = publicUrl.replace('/static/', '');
      const localFilePath = path.resolve('uploads', localRelPath);
      if (fs.existsSync(localFilePath)) {
        return res.sendFile(localFilePath);
      }
    }

    res.redirect(302, publicUrl);
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

      // Invalidate product caches
      await redisService.delPattern('products:*');

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

      // Invalidate product caches
      await redisService.delPattern('products:*');

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

    // Invalidate product caches
    await redisService.delPattern('products:*');

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
        res.status(400).json({ success: false, message: 'No image file uploaded', detail: 'No image file uploaded' });
        return;
      }

      const imageUrl = await s3Service.uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
      product.image_url = imageUrl;
      product.touch();
      await product.save();

      // Invalidate product caches
      await redisService.delPattern('products:*');

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
