import pytest
from app.services.print_pricing_engine import print_pricing_engine


def test_volume_discount_thresholds():
    quote_small = print_pricing_engine.compute_print_quote(num_pages=10, num_copies=1)
    assert quote_small["volume_discount_percentage"] == 0.0

    quote_medium = print_pricing_engine.compute_print_quote(num_pages=50, num_copies=1)
    assert quote_medium["volume_discount_percentage"] == 10.0

    quote_large = print_pricing_engine.compute_print_quote(num_pages=150, num_copies=1)
    assert quote_large["volume_discount_percentage"] == 20.0


def test_double_sided_discount():
    quote_single = print_pricing_engine.compute_print_quote(
        num_pages=20, is_double_sided=False
    )
    quote_double = print_pricing_engine.compute_print_quote(
        num_pages=20, is_double_sided=True
    )
    # Double-sided print should be cheaper due to 15% discount
    assert quote_double["items_subtotal"] < quote_single["items_subtotal"]


def test_binding_and_gsm_multipliers():
    quote_spiral = print_pricing_engine.compute_print_quote(
        num_pages=10, gsm=80, binding_type="spiral"
    )
    assert quote_spiral["total_binding_cost"] == 30.0
    assert quote_spiral["effective_page_rate"] > 2.0  # 80 GSM multiplier applied
