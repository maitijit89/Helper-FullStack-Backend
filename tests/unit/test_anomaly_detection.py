import pytest
from datetime import datetime, timedelta, timezone
from app.schemas.location import GPSLocation
from app.services.anomaly_detection_engine import anomaly_detection_engine


def test_gps_spoofing_detection():
    # Partner moves 50 km in 2 minutes (1500 km/h) -> GPS Teleportation anomaly!
    prev_loc = GPSLocation(latitude=19.0760, longitude=72.8770, is_gps_enabled=True)
    prev_time = datetime.now(timezone.utc) - timedelta(minutes=2)

    curr_loc = GPSLocation(latitude=19.5000, longitude=73.2000, is_gps_enabled=True)
    curr_time = datetime.now(timezone.utc)

    res = anomaly_detection_engine.detect_gps_spoofing(
        prev_location=prev_loc,
        prev_timestamp=prev_time,
        curr_location=curr_loc,
        curr_timestamp=curr_time,
    )

    assert res["is_anomalous"] is True
    assert res["anomaly_type"] == "gps_spoofing_teleportation"
    assert res["calculated_speed_kmh"] > 120.0


def test_normal_gps_movement():
    # Partner moves 0.5 km in 5 minutes (6 km/h) -> Normal movement
    prev_loc = GPSLocation(latitude=19.0760, longitude=72.8770, is_gps_enabled=True)
    prev_time = datetime.now(timezone.utc) - timedelta(minutes=5)

    curr_loc = GPSLocation(latitude=19.0800, longitude=72.8800, is_gps_enabled=True)
    curr_time = datetime.now(timezone.utc)

    res = anomaly_detection_engine.detect_gps_spoofing(
        prev_location=prev_loc,
        prev_timestamp=prev_time,
        curr_location=curr_loc,
        curr_timestamp=curr_time,
    )

    assert res["is_anomalous"] is False
    assert res["calculated_speed_kmh"] < 120.0


def test_order_velocity_spam_detection():
    now = datetime.now(timezone.utc)
    timestamps = [now - timedelta(seconds=i * 5) for i in range(10)]

    res = anomaly_detection_engine.detect_order_velocity_anomaly(order_timestamps=timestamps)
    assert res["is_anomalous"] is True
    assert res["anomaly_type"] == "order_velocity_spamming"
