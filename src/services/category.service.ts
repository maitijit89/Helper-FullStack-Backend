import { Category, ICategory } from '../models/Category';
import { Product } from '../models/Product';
import { NotFoundException, ConflictException } from '../middlewares/errorHandler';
import { CreateCategoryInput, UpdateCategoryInput } from '../schemas/category.schema';

export class CategoryService {
  /**
   * List all active categories with associated product count
   */
  async listCategories(includeInactive: boolean = false): Promise<any[]> {
    const filter = includeInactive ? {} : { isActive: true };
    const categories = await Category.find(filter).sort({ name: 1 });

    // Aggregate product counts per category in Catalog DB
    const productCounts = await Product.aggregate([
      { $match: { isDeleted: false, isActive: true } },
      { $group: { _id: { $toLower: '$category' }, count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>();
    productCounts.forEach((pc) => {
      if (pc._id) countMap.set(pc._id, pc.count);
    });

    return categories.map((cat) => ({
      id: cat._id.toString(),
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      accessoryCategories: cat.accessoryCategories,
      isActive: cat.isActive,
      productCount: countMap.get(cat.name.toLowerCase()) || 0,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
    }));
  }

  /**
   * Get category details by slug
   */
  async getCategoryBySlug(slug: string): Promise<ICategory> {
    const category = await Category.findOne({ slug: slug.toLowerCase() });
    if (!category) {
      throw new NotFoundException(`Category '${slug}' not found.`);
    }
    return category;
  }

  /**
   * Create new category (Admin)
   */
  async createCategory(input: CreateCategoryInput): Promise<ICategory> {
    const slug = (input.slug || input.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existing = await Category.findOne({ slug });
    if (existing) {
      throw new ConflictException(`Category with slug '${slug}' already exists.`);
    }

    const category = await Category.create({
      name: input.name,
      slug,
      description: input.description,
      icon: input.icon,
      accessoryCategories: input.accessoryCategories || [],
      isActive: input.isActive !== undefined ? input.isActive : true,
    });

    return category;
  }

  /**
   * Update category (Admin)
   */
  async updateCategory(id: string, input: UpdateCategoryInput): Promise<ICategory> {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundException(`Category ${id} not found.`);
    }

    if (input.name) category.name = input.name;
    if (input.description !== undefined) category.description = input.description;
    if (input.icon !== undefined) category.icon = input.icon;
    if (input.accessoryCategories !== undefined) category.accessoryCategories = input.accessoryCategories;
    if (input.isActive !== undefined) category.isActive = input.isActive;

    await category.save();
    return category;
  }

  /**
   * Soft-delete / deactivate category (Admin)
   */
  async deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundException(`Category ${id} not found.`);
    }

    category.isActive = false;
    await category.save();

    return {
      success: true,
      message: `Category '${category.name}' deactivated successfully.`,
    };
  }
}

export const categoryService = new CategoryService();
