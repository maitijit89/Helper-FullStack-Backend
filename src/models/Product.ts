import mongoose, { Schema, Document } from 'mongoose';

export enum ProductCategory {
  SNACKS = 'snacks',
  BEVERAGES = 'beverages',
  CAKES = 'cakes',
  STATIONERY = 'stationery',
  PRINTING = 'printing',
  PORTER_5KG = 'porter_5kg',
}

export interface IProduct extends Document {
  name: string;
  category: ProductCategory;
  description?: string;
  price: number;
  unit: string;
  stock_quantity: number;
  is_available: boolean;
  image_url?: string;
  tags: string[];
  search_keywords: string[];
  created_at: Date;
  updated_at: Date;
  touch(): void;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, index: true, trim: true },
    category: { type: String, enum: Object.values(ProductCategory), required: true, index: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, default: 'item' },
    stock_quantity: { type: Number, default: 100, min: 0 },
    is_available: { type: Boolean, default: true, index: true },
    image_url: { type: String },
    tags: [{ type: String }],
    search_keywords: [{ type: String }],
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

ProductSchema.index({ category: 1, is_available: 1 });
ProductSchema.index({ is_available: 1, price: 1 });
ProductSchema.index({ name: 'text', description: 'text', search_keywords: 'text', tags: 'text' });

ProductSchema.methods.touch = function () {
  this.updated_at = new Date();
};

export function formatPublicImageUrl(url?: string): string | undefined {
  if (!url) return url;
  const gdriveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
  if (gdriveMatch && gdriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gdriveMatch[1]}`;
  }
  return url;
}

ProductSchema.pre('save', function (next) {
  if (this.image_url) {
    this.image_url = formatPublicImageUrl(this.image_url);
  }
  next();
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema, 'products');
