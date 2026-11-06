import { Product, IProduct, ICompatibleAccessory } from '../models/Product';
import { Cart } from '../models/Cart';
import { NotFoundException } from '../middlewares/errorHandler';

export interface ProductSuggestionsResult {
  primaryProduct: {
    id: string;
    title: string;
    category: string;
    price: number;
  };
  essential: IProduct[];
  recommended: IProduct[];
  chainedAccessories: IProduct[];
  bundleDiscountNote?: string;
}

export class RecommendationService {
  /**
   * Algorithm 3: Contextual Accessory & Chained Cross-Sell Recommendation Engine
   * Example:
   * - User buys/views iPhone -> Suggests Charger & Cover.
   * - User adds Cover to purchase list -> Detects Cover is selected, dynamically
   *   expands suggestions to Screen Protector, Lens Guard, MagSafe Wallet, Power Bank!
   */
  async getProductSuggestions(
    productId: string,
    activeCartProductIds: string[] = []
  ): Promise<ProductSuggestionsResult> {
    const product = await Product.findOne({ _id: productId, isDeleted: false, isActive: true });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    const cartSet = new Set(activeCartProductIds.map((id) => id.toString()));

    // 1. Direct Compatible Accessories declared on the product
    const directAccessoryIds = (product.compatibleAccessories || []).map((acc) =>
      acc.productId.toString()
    );

    // Fetch full product documents for these accessories from Catalog DB
    const directAccessoryProducts = await Product.find({
      _id: { $in: directAccessoryIds },
      isDeleted: false,
      isActive: true,
    });

    const accessoryMap = new Map<string, IProduct>();
    directAccessoryProducts.forEach((p) => accessoryMap.set(p._id.toString(), p));

    const essential: IProduct[] = [];
    const recommended: IProduct[] = [];
    const inCartAccessories: ICompatibleAccessory[] = [];

    // Categorize accessories and detect which ones are already selected/in cart
    for (const acc of product.compatibleAccessories || []) {
      const accIdStr = acc.productId.toString();
      const accProduct = accessoryMap.get(accIdStr);
      if (!accProduct) continue;

      if (cartSet.has(accIdStr)) {
        inCartAccessories.push(acc);
      } else {
        if (acc.relationType === 'essential') {
          essential.push(accProduct);
        } else {
          recommended.push(accProduct);
        }
      }
    }

    // 2. Chained Accessory Expansion Engine:
    // If user has already added any accessory (e.g. Cover) to their cart/purchase list,
    // dynamically discover Tier-2 chained accessories!
    const chainedAccessories: IProduct[] = [];
    const chainedProductIdsToFetch = new Set<string>();

    if (inCartAccessories.length > 0) {
      // Find accessories of the selected accessory items
      for (const inCartAcc of inCartAccessories) {
        const itemDoc = accessoryMap.get(inCartAcc.productId.toString());
        if (itemDoc && itemDoc.compatibleAccessories) {
          for (const subAcc of itemDoc.compatibleAccessories) {
            const subId = subAcc.productId.toString();
            if (!cartSet.has(subId) && subId !== productId) {
              chainedProductIdsToFetch.add(subId);
            }
          }
        }
      }

      // Also discover complementary products from the same category or brand
      const selectedCategories = inCartAccessories.map((a) => a.category);
      const categoryComplements = await Product.find({
        category: { $in: selectedCategories },
        _id: { $nin: [product._id, ...Array.from(cartSet), ...directAccessoryIds] },
        isDeleted: false,
        isActive: true,
      })
        .sort({ salesCount: -1, viewCount: -1 })
        .limit(4);

      categoryComplements.forEach((p) => chainedAccessories.push(p));
    }

    // If chained IDs were discovered, fetch their product documents
    if (chainedProductIdsToFetch.size > 0) {
      const fetchedChained = await Product.find({
        _id: { $in: Array.from(chainedProductIdsToFetch) },
        isDeleted: false,
        isActive: true,
      });
      fetchedChained.forEach((p) => chainedAccessories.push(p));
    }

    // If no direct accessories configured yet on product, fallback to same-category accessories
    if (essential.length === 0 && recommended.length === 0) {
      const genericAccessories = await Product.find({
        category: { $regex: new RegExp(`${product.category}|Accessory|Accessories`, 'i') },
        _id: { $ne: product._id, $nin: Array.from(cartSet) },
        isDeleted: false,
        isActive: true,
      })
        .sort({ isFeatured: -1, salesCount: -1 })
        .limit(6);

      genericAccessories.forEach((acc, idx) => {
        if (idx < 2) essential.push(acc);
        else recommended.push(acc);
      });
    }

    return {
      primaryProduct: {
        id: product._id.toString(),
        title: product.title,
        category: product.category,
        price: product.discountPrice ?? product.price,
      },
      essential,
      recommended,
      chainedAccessories,
      bundleDiscountNote:
        inCartAccessories.length > 0
          ? 'Add 1 more accessory to get an extra 10% bundle discount on your accessories!'
          : undefined,
    };
  }

  /**
   * Recommendations for cart view: combines all items in cart, chains their accessories,
   * deduplicates, and surfaces missing essentials.
   */
  async getCartRecommendations(userId: string): Promise<IProduct[]> {
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      // Return featured items if cart is empty
      return Product.find({ isFeatured: true, isDeleted: false, isActive: true }).limit(8);
    }

    const cartProductIds = cart.items.map((i) => i.productId);
    const cartSet = new Set(cartProductIds);

    // Fetch products in cart to inspect their compatibleAccessories
    const cartProducts = await Product.find({
      _id: { $in: cartProductIds },
      isDeleted: false,
    });

    const candidateAccessoryIds = new Set<string>();

    for (const cp of cartProducts) {
      if (cp.compatibleAccessories && cp.compatibleAccessories.length > 0) {
        for (const acc of cp.compatibleAccessories) {
          const accId = acc.productId.toString();
          if (!cartSet.has(accId)) {
            candidateAccessoryIds.add(accId);
          }
        }
      }
    }

    let recommendations: IProduct[] = [];

    if (candidateAccessoryIds.size > 0) {
      recommendations = await Product.find({
        _id: { $in: Array.from(candidateAccessoryIds) },
        isDeleted: false,
        isActive: true,
      }).sort({ salesCount: -1 });
    }

    // If fewer than 4 recommendations, top up with complementary category products
    if (recommendations.length < 4) {
      const cartCategories = cart.items.map((i) => i.category);
      const topUps = await Product.find({
        category: { $in: cartCategories },
        _id: { $nin: [...cartProductIds, ...recommendations.map((r) => r._id.toString())] },
        isDeleted: false,
        isActive: true,
      })
        .sort({ isFeatured: -1, salesCount: -1 })
        .limit(6 - recommendations.length);

      recommendations.push(...topUps);
    }

    return recommendations;
  }
}

export const recommendationService = new RecommendationService();
