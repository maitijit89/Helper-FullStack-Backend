import pytest
from app.schemas.partner import DeliveryMode
from app.services.dispatch_engine import dispatch_engine


def test_eta_calculation():
    # 5 km bike delivery
    eta_bike = dispatch_engine.calculate_eta_minutes(5.0, mode=DeliveryMode.BIKE)
    # Speed 25 km/h -> 5km = 12 min + 3 min buffer = 15.0 min
    assert eta_bike == 15.0

    # 1 km walk delivery
    eta_walk = dispatch_engine.calculate_eta_minutes(1.0, mode=DeliveryMode.WALKING)

    # Speed 4.5 km/h -> 1km = 13.3 min + 3 min buffer = 16.3 min
    assert eta_walk == 16.3


def test_partner_match_score():
    score_close = dispatch_engine.compute_partner_match_score(
        distance_km=0.5, rating=4.8, acceptance_rate=0.95, active_orders_count=0
    )
    score_far = dispatch_engine.compute_partner_match_score(
        distance_km=4.5, rating=4.8, acceptance_rate=0.95, active_orders_count=0
    )

    # Closer partner must have higher match score
    assert score_close > score_far

    # Partner with active orders gets penalty
    score_busy = dispatch_engine.compute_partner_match_score(
        distance_km=0.5, rating=4.8, acceptance_rate=0.95, active_orders_count=2
    )
    assert score_close > score_busy
