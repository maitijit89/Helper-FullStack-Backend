import crypto from 'crypto';
import { Product, IProduct, ICompatibleAccessory } from '../models/Product';
import { ProductEvent } from '../models/ProductEvent';
import { UserInterestProfile } from '../models/UserInterestProfile';
import { CreateProductInput, UpdateProductInput } from '../schemas/product.schema';
import { NotFoundException, ConflictException } from '../middlewares/errorHandler';

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const randomSuffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${randomSuffix}`;
}

function generateSku(category: string): string {
  const prefix = category.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'HS');
  const rand = crypto.randomInt(10000, 99999);
  return `${prefix}-${rand}`;
}

export class ProductService {
  async createProduct(input: CreateProductInput): Promise<IProduct> {
    const slug = input.slug || generateSlug(input.title);
    const sku = input.sku || generateSku(input.category);

    const existingSlug = await Product.findOne({ slug });
    if (existingSlug) {
      throw new ConflictException('A product with this slug already exists.');
    }

    const existingSku = await Product.findOne({ sku });
    if (existingSku) {
      throw new ConflictException('A product with this SKU already exists.');
    }

    const product = await Product.create({
      ...input,
      slug,
      sku,
    });

    return product;
  }

  async getProductById(id: string, userId?: string): Promise<IProduct> {
    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    // Record interaction view event asynchronously in Analytics DB
    product.viewCount += 1;
    product.save().catch(() => {});

    if (userId) {
      ProductEvent.create({
        userId,
        productId: product._id.toString(),
        category: product.category,
        eventType: 'view',
      }).catch(() => {});

      // Increment category affinity in UserInterestProfile
      UserInterestProfile.findOneAndUpdate(
        { userId, 'categoryAffinities.category': product.category },
        {
          $inc: { 'categoryAffinities.$.weight': 2 },
          $set: { 'categoryAffinities.$.lastInteractedAt': new Date() },
        }
      ).then(async (res) => {
        if (!res) {
          await UserInterestProfile.findOneAndUpdate(
            { userId },
            {
              $push: {
                categoryAffinities: {
                  category: product.category,
                  weight: 15,
                  lastInteractedAt: new Date(),
                },
              },
            },
            { upsert: true }
          );
        }
      }).catch(() => {});
    }

    return product;
  }

  async listProducts(query: {
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    isFeatured?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ products: IProduct[]; total: number; page: number; totalPages: number }> {
    const filter: Record<string, any> = { isDeleted: false, isActive: true };

    if (query.category) {
      filter.category = new RegExp(`^${query.category.trim()}$`, 'i');
    }

    if (query.isFeatured !== undefined) {
      filter.isFeatured = query.isFeatured;
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {};
      if (query.minPrice !== undefined) filter.price.$gte = query.minPrice;
      if (query.maxPrice !== undefined) filter.price.$lte = query.maxPrice;
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
        { brand: searchRegex },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(filter),
    ]);

    return {
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<IProduct> {
    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    if (input.sku && input.sku !== product.sku) {
      const existing = await Product.findOne({ sku: input.sku, _id: { $ne: id } });
      if (existing) {
        throw new ConflictException('SKU is already in use by another product.');
      }
    }

    Object.assign(product, input);
    await product.save();
    return product;
  }

  async deleteProduct(id: string): Promise<{ message: string }> {
    const product = await Product.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    product.isDeleted = true;
    product.isActive = false;
    await product.save();

    return { message: 'Product deleted successfully.' };
  }

  async linkAccessories(productId: string, accessories: ICompatibleAccessory[]): Promise<IProduct> {
    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    product.compatibleAccessories = accessories;
    await product.save();
    return product;
  }
}

export const productService = new ProductService();
