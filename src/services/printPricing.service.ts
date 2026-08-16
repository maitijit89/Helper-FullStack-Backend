export interface PrintPricingOptions {
  num_pages: number;
  num_copies?: number;
  color_mode?: 'black_and_white' | 'color' | string;
  paper_size?: 'A4' | 'A3' | 'Letter' | string;
  is_double_sided?: boolean;
  binding_type?: 'none' | 'spiral' | 'channel_file' | string;
}

export interface PrintPriceBreakdown {
  num_pages: number;
  num_copies: number;
  effective_sheets: number;
  rate_per_page: number;
  printing_subtotal: number;
  binding_cost: number;
  total_price: number;
}

class PrintPricingEngine {
  calculatePrice(options: PrintPricingOptions): PrintPriceBreakdown {
    const numPages = Math.max(1, options.num_pages);
    const numCopies = Math.max(1, options.num_copies || 1);
    const isColor = options.color_mode === 'color';
    const isDoubleSided = !!options.is_double_sided;
    const paperSize = options.paper_size || 'A4';
    const bindingType = options.binding_type || 'none';

    // Base rates per page side
    let ratePerPage = isColor ? 10.0 : 2.0; // ₹2 for B&W, ₹10 for Color

    // Paper size multiplier
    if (paperSize === 'A3') {
      ratePerPage *= 2.0;
    }

    // Double sided discount per sheet (2 pages printed on 1 sheet)
    let effectiveSheets = numPages;
    if (isDoubleSided) {
      effectiveSheets = Math.ceil(numPages / 2);
      // Slight discount for duplex
      ratePerPage = isColor ? 8.0 : 1.5;
    }

    const printingSubtotal = +(numPages * ratePerPage * numCopies).toFixed(2);

    // Binding costs per copy
    let bindingRate = 0.0;
    if (bindingType === 'spiral') {
      bindingRate = 35.0; // ₹35 per spiral bound copy
    } else if (bindingType === 'channel_file') {
      bindingRate = 20.0; // ₹20 per channel file
    }

    const bindingCost = +(bindingRate * numCopies).toFixed(2);
    const totalPrice = +(printingSubtotal + bindingCost).toFixed(2);

    return {
      num_pages: numPages,
      num_copies: numCopies,
      effective_sheets: effectiveSheets * numCopies,
      rate_per_page: ratePerPage,
      printing_subtotal: printingSubtotal,
      binding_cost: bindingCost,
      total_price: totalPrice,
    };
  }
}

export const printPricingEngine = new PrintPricingEngine();
