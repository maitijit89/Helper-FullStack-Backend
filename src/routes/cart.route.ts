import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { AddToCartSchema, UpdateCartItemSchema } from '../schemas/cart.schema';
import { Cart } from '../models/Cart';
import { Product } from '../models/Product';
import { NotFoundException, BadRequestException } from '../middlewares/errorHandler';

const router = Router();

// Get user's cart
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user!._id.toString();
    let cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      cart = new Cart({ customer_id: customerId, items: [], items_total: 0 });
      await cart.save();
    }
    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (err) {
    next(err);
  }
});

// Add item to cart
router.post('/items', authenticate, validate(AddToCartSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user!._id.toString();
    const { product_id, quantity } = req.body;

    const product = await Product.findById(product_id);
    if (!product || !product.is_available) {
      throw new NotFoundException('Product not found or unavailable');
    }

    let cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      cart = new Cart({ customer_id: customerId, items: [], items_total: 0 });
    }

    const existingIndex = cart.items.findIndex(item => item.product_id === product_id);
    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
      cart.items[existingIndex].subtotal = +(cart.items[existingIndex].quantity * product.price).toFixed(2);
    } else {
      cart.items.push({
        product_id,
        product_name: product.name,
        unit_price: product.price,
        quantity,
        subtotal: +(quantity * product.price).toFixed(2),
      });
    }

    cart.recalculateTotal();

    if (cart.items_total > 100.0) {
      throw new BadRequestException(
        `Cart total ₹${cart.items_total.toFixed(2)} exceeds the maximum order limit of ₹100.00. Please reduce item quantities.`
      );
    }

    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: cart,
    });
  } catch (err) {
    next(err);
  }
});

// Update item quantity
router.patch('/items/:product_id', authenticate, validate(UpdateCartItemSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user!._id.toString();
    const { quantity } = req.body;
    const productId = req.params.product_id;

    let cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      throw new NotFoundException('Cart is empty');
    }

    if (quantity <= 0) {
      cart.items = cart.items.filter(item => item.product_id !== productId);
    } else {
      const item = cart.items.find(i => i.product_id === productId);
      if (item) {
        item.quantity = quantity;
        item.subtotal = +(quantity * item.unit_price).toFixed(2);
      }
    }

    cart.recalculateTotal();

    if (cart.items_total > 100.0) {
      throw new BadRequestException(
        `Cart total ₹${cart.items_total.toFixed(2)} exceeds the maximum order limit of ₹100.00. Please reduce item quantities.`
      );
    }

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (err) {
    next(err);
  }
});

// Remove item from cart
router.delete('/items/:product_id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user!._id.toString();
    const productId = req.params.product_id;

    let cart = await Cart.findOne({ customer_id: customerId });
    if (cart) {
      cart.items = cart.items.filter(item => item.product_id !== productId);
      cart.recalculateTotal();
      await cart.save();
    }

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: cart,
    });
  } catch (err) {
    next(err);
  }
});

// Clear cart
router.delete('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user!._id.toString();
    let cart = await Cart.findOne({ customer_id: customerId });
    if (cart) {
      cart.items = [];
      cart.items_total = 0;
      cart.touch();
      await cart.save();
    }

    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
