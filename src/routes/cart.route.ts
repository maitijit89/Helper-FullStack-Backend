import { Router, Request, Response, NextFunction } from 'express';
import { cartService } from '../services/cart.service';
import { recommendationService } from '../services/recommendation.service';
import { authenticate } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { addToCartSchema } from '../schemas/cart.schema';

const router = Router();

// Cart requires authenticated user
router.use(authenticate);

/**
 * @route   GET /api/v1/cart
 * @desc    Get user's active cart with calculated dwell times per item
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cart = await cartService.getCart(req.user!.id);
    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/cart/items
 * @desc    Add item to cart (records addedAt timestamp for dwell time tracking)
 */
router.post(
  '/items',
  validateBody(addToCartSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { productId, quantity, attributes } = req.body;
      const updatedCart = await cartService.addToCart(
        req.user!.id,
        productId,
        quantity,
        attributes
      );

      res.status(200).json({
        success: true,
        message: 'Item added to cart.',
        data: updatedCart,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/v1/cart/items/:productId
 * @desc    Remove an item from cart
 */
router.delete('/items/:productId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updatedCart = await cartService.removeFromCart(req.user!.id, req.params.productId);
    res.status(200).json({
      success: true,
      message: 'Item removed from cart.',
      data: updatedCart,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/cart
 * @desc    Clear entire cart
 */
router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cartService.clearCart(req.user!.id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/cart/recommendations
 * @desc    Contextual cross-sell recommendations based on all items in active cart
 */
router.get('/recommendations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recommendations = await recommendationService.getCartRecommendations(req.user!.id);
    res.status(200).json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
