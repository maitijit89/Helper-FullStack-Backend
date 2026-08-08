import pytest
from app.services.surge_pricing_engine import surge_pricing_engine


def test_surge_fee_application():
    base_fee = 30.0
    surged = surge_pricing_engine.apply_surge_to_delivery_fee(base_fee, surge_multiplier=1.5)
    assert surged == 45.0

    normal = surge_pricing_engine.apply_surge_to_delivery_fee(base_fee, surge_multiplier=1.0)
    assert normal == 30.0
