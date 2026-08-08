import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class AssignmentWriterEngine:
    """
    Service Engine for Handwritten Assignment Writer orders.
    Calculates cost based on:
    - Pages to write by hand (₹5.00 / page)
    - Paper type (A4 Ruled/Unruled = ₹1.00/page, Practical Sheet = ₹2.00/page)
    - File & Binding belongings (None = ₹0, Channel File = ₹20.00, Spiral File = ₹30.00)
    """

    HANDWRITING_RATE_PER_PAGE = 5.0
    DELIVERY_FEE = 25.0

    PAPER_RATES = {
        "a4_ruled": 1.0,
        "a4_unruled": 1.0,
        "practical_sheet": 2.0,
    }

    BINDING_RATES = {
        "none": 0.0,
        "channel_file": 20.0,
        "spiral": 30.0,
    }

    def calculate_assignment_cost(
        self,
        num_pages: int,
        paper_type: str = "a4_ruled",
        binding_type: str = "none",
        ink_color: str = "blue",
    ) -> Dict[str, Any]:
        p_type = paper_type.lower()
        b_type = binding_type.lower()

        paper_rate = self.PAPER_RATES.get(p_type, 1.0)
        binding_cost = self.BINDING_RATES.get(b_type, 0.0)

        writing_cost = round(self.HANDWRITING_RATE_PER_PAGE * num_pages, 2)
        paper_cost = round(paper_rate * num_pages, 2)
        items_total = round(writing_cost + paper_cost + binding_cost, 2)
        total_amount = round(items_total + self.DELIVERY_FEE, 2)

        return {
            "num_pages": num_pages,
            "paper_type": paper_type,
            "binding_type": binding_type,
            "ink_color": ink_color,
            "handwriting_rate_per_page": self.HANDWRITING_RATE_PER_PAGE,
            "paper_rate_per_page": paper_rate,
            "writing_cost": writing_cost,
            "paper_cost": paper_cost,
            "binding_cost": binding_cost,
            "items_total": items_total,
            "delivery_fee": self.DELIVERY_FEE,
            "total_amount": total_amount,
            "min_order_price_met": items_total >= 10.0,
        }


assignment_writer_engine = AssignmentWriterEngine()
