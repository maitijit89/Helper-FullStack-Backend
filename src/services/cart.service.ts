import { Cart, ICart, ICartItem } from '../models/Cart';
import { Product } from '../models/Product';
import { ProductEvent } from '../models/ProductEvent';
import { UserInterestProfile } from '../models/UserInterestProfile';
import { NotFoundException, BadRequestException } from '../middlewares/errorHandler';

export interface EnrichedCartItem extends ICartItem {
  dwellMinutes: number;
}

export interface EnrichedCart {
  userId: string;
  items: EnrichedCartItem[];
  totalAmount: number;
  itemCount: number;
  hasDwellingItems: boolean;
}

export class CartService {
  async getCart(userId: string): Promise<EnrichedCart> {
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, items: [], totalAmount: 0 });
    }

    const now = Date.now();
    let total = 0;
    let hasDwellingItems = false;

    const enrichedItems: EnrichedCartItem[] = cart.items.map((item) => {
      const addedTime = new Date(item.addedAt).getTime();
      const dwellMinutes = Math.max(0, Math.floor((now - addedTime) / (60 * 1000)));
      if (dwellMinutes >= 15) {
        hasDwellingItems = true;
      }
      total += item.price * item.quantity;

      return {
        productId: item.productId,
        title: item.title,
        category: item.category,
        price: item.price,
        quantity: item.quantity,
        addedAt: item.addedAt,
        attributes: item.attributes,
        dwellMinutes,
      };
    });

    cart.totalAmount = Math.round(total * 100) / 100;
    cart.save().catch(() => {});

    return {
      userId,
      items: enrichedItems,
      totalAmount: cart.totalAmount,
      itemCount: enrichedItems.reduce((acc, it) => acc + it.quantity, 0),
      hasDwellingItems,
    };
  }

  async addToCart(
    userId: string,
    productId: string,
    quantity: number = 1,
    attributes: Record<string, any> = {}
  ): Promise<EnrichedCart> {
    const product = await Product.findOne({ _id: productId, isDeleted: false, isActive: true });
    if (!product) {
      throw new NotFoundException('Product not found or is currently unavailable.');
    }

    if (product.stock < quantity) {
      throw new BadRequestException(`Insufficient stock. Only ${product.stock} available.`);
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const itemPrice = product.discountPrice ?? product.price;
    const existingIndex = cart.items.findIndex((item) => item.productId === productId);

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
      cart.items[existingIndex].price = itemPrice;
      // Do not reset addedAt so dwell time reflects true cart persistence
    } else {
      cart.items.push({
        productId,
        title: product.title,
        category: product.category,
        price: itemPrice,
        quantity,
        addedAt: new Date(),
        attributes,
      });
    }

    await cart.save();

    // Async stats & analytics logging
    product.cartAddCount += quantity;
    product.save().catch(() => {});

    ProductEvent.create({
      userId,
      productId,
      category: product.category,
      eventType: 'cart_add',
      metadata: { quantity, price: itemPrice },
    }).catch(() => {});

    // Update user interest in category
    UserInterestProfile.findOneAndUpdate(
      { userId, 'categoryAffinities.category': product.category },
      {
        $inc: { 'categoryAffinities.$.weight': 10 },
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
                weight: 25,
                lastInteractedAt: new Date(),
              },
            },
          },
          { upsert: true }
        );
      }
    }).catch(() => {});

    return this.getCart(userId);
  }

  async removeFromCart(userId: string, productId: string): Promise<EnrichedCart> {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      throw new NotFoundException('Cart not found.');
    }

    const removedItem = cart.items.find((item) => item.productId === productId);
    cart.items = cart.items.filter((item) => item.productId !== productId);
    await cart.save();

    if (removedItem) {
      ProductEvent.create({
        userId,
        productId,
        category: removedItem.category,
        eventType: 'cart_remove',
      }).catch(() => {});
    }

    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<{ message: string }> {
    await Cart.findOneAndUpdate({ userId }, { items: [], totalAmount: 0 });
    return { message: 'Cart cleared successfully.' };
  }
}

export const cartService = new CartService();
