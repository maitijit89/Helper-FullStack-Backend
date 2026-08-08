import logging
import math
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Base page rate table (INR per page)
BASE_PAGE_RATES = {
    "black_and_white": 2.0,
    "color": 10.0,
    "mixed": 6.0,
}

# Paper GSM price multipliers
GSM_MULTIPLIERS = {
    70: 1.0,      # Standard paper
    80: 1.15,     # Premium executive paper
    100: 1.35,    # Project presentation paper
    300: 2.0,     # Cardstock / Glossy photo paper
}

# Paper size multipliers
PAPER_SIZE_MULTIPLIERS = {
    "A4": 1.0,
    "A3": 1.6,
    "A5": 0.8,
    "LETTER": 1.0,
    "LEGAL": 1.25,
}

# Binding option fixed rates (INR per copy)
BINDING_RATES = {
    "none": 0.0,
    "stapled": 5.0,
    "channel_file": 20.0,
    "spiral": 30.0,
    "softcover": 60.0,
    "hardcover": 120.0,
}


class PrintPricingEngine:
    """
    Advanced Dynamic Tiered Pricing Engine for Document Print & Xerox Services.
    Features:
    - Volume tier discounts (1-20 pages = 0%, 21-100 pages = 10% off, >100 pages = 20% off)
    - Paper GSM weight multipliers
    - Double-sided layout discount (15% off printing)
    - Binding & finishing add-on pricing
    """

    def calculate_volume_discount_percentage(self, total_printed_pages: int) -> float:
        """
        Volume Tier Discount Algorithm:
        - 1 to 20 total pages: 0% discount
        - 21 to 100 total pages: 10% discount
        - 101 to 500 total pages: 20% discount
        - > 500 total pages: 25% bulk discount
        """
        if total_printed_pages <= 20:
            return 0.0
        elif total_printed_pages <= 100:
            return 0.10
        elif total_printed_pages <= 500:
            return 0.20
        else:
            return 0.25

    def compute_print_quote(
        self,
        num_pages: int,
        num_copies: int = 1,
        color_mode: str = "black_and_white",
        paper_size: str = "A4",
        gsm: int = 70,
        is_double_sided: bool = False,
        binding_type: str = "none",
        delivery_mode: str = "standard",
    ) -> Dict:
        """
        Compute full dynamic print quotation with volume tiering and itemized breakdown.
        """
        norm_color = color_mode.lower().strip()
        norm_size = paper_size.upper().strip()
        norm_binding = binding_type.lower().strip()

        base_rate = BASE_PAGE_RATES.get(norm_color, 2.0)
        size_multiplier = PAPER_SIZE_MULTIPLIERS.get(norm_size, 1.0)
        gsm_multiplier = GSM_MULTIPLIERS.get(gsm, 1.0)

        # Effective base page rate adjusted for size and GSM
        effective_page_rate = round(base_rate * size_multiplier * gsm_multiplier, 2)

        total_impression_pages = num_pages * num_copies
        raw_printing_cost = effective_page_rate * total_impression_pages

        # Volume tier discount
        volume_discount_pct = self.calculate_volume_discount_percentage(total_impression_pages)
        volume_discount_amount = raw_printing_cost * volume_discount_pct

        # Double-sided discount (15% off page printing cost)
        double_sided_discount_pct = 0.15 if is_double_sided else 0.0
        double_sided_discount_amount = (raw_printing_cost - volume_discount_amount) * double_sided_discount_pct

        discounted_printing_cost = raw_printing_cost - volume_discount_amount - double_sided_discount_amount

        # Binding costs
        per_copy_binding_rate = BINDING_RATES.get(norm_binding, 0.0)
        total_binding_cost = per_copy_binding_rate * num_copies

        items_subtotal = round(discounted_printing_cost + total_binding_cost, 2)

        # Delivery fee calculation
        base_delivery_fee = 20.0
        if delivery_mode.lower() == "express":
            delivery_fee = 35.0
        elif items_subtotal >= 200.0:
            delivery_fee = 0.0  # Free delivery for orders >= 200 INR
        else:
            delivery_fee = base_delivery_fee

        total_amount = round(items_subtotal + delivery_fee, 2)

        return {
            "num_pages": num_pages,
            "num_copies": num_copies,
            "total_impression_pages": total_impression_pages,
            "color_mode": norm_color,
            "paper_size": norm_size,
            "gsm": gsm,
            "is_double_sided": is_double_sided,
            "binding_type": norm_binding,
            "effective_page_rate": effective_page_rate,
            "raw_printing_cost": round(raw_printing_cost, 2),
            "volume_discount_percentage": round(volume_discount_pct * 100.0, 1),
            "volume_discount_amount": round(volume_discount_amount, 2),
            "double_sided_discount_amount": round(double_sided_discount_amount, 2),
            "total_binding_cost": round(total_binding_cost, 2),
            "items_subtotal": items_subtotal,
            "delivery_fee": delivery_fee,
            "total_amount": total_amount,
            "savings_total": round(volume_discount_amount + double_sided_discount_amount, 2),
        }


print_pricing_engine = PrintPricingEngine()
