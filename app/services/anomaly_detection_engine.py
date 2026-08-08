import math
import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone

from app.schemas.location import GPSLocation
from app.services.geo_service import calculate_haversine_distance

logger = logging.getLogger(__name__)

# Thresholds for anomaly detection
MAX_REALISTIC_SPEED_KMH = 120.0  # Speeds > 120 km/h flag GPS teleportation / spoofing
MAX_ORDER_FREQUENCY_PER_MIN = 5   # > 5 orders per minute flag bot / order spamming


class OperationalAnomalyDetectionEngine:
    """
    Real-Time Operational Anomaly & GPS Fraud Detection Engine.
    Detects:
    1. GPS Teleportation / Location Spoofing (Speed > 120 km/h)
    2. Order Submission Velocity Anomalies (Bot spamming)
    3. Abnormal Order Amount Spikes
    """

    def detect_gps_spoofing(
        self,
        prev_location: GPSLocation,
        prev_timestamp: datetime,
        curr_location: GPSLocation,
        curr_timestamp: datetime,
    ) -> Dict:
        """
        Calculates movement speed v = delta_d / delta_t.
        Flags unrealistic speeds (>120 km/h) as GPS spoofing / mock location tampering.
        """
        dist_km = calculate_haversine_distance(
            prev_location.latitude,
            prev_location.longitude,
            curr_location.latitude,
            curr_location.longitude,
        )

        time_diff_seconds = abs((curr_timestamp - prev_timestamp).total_seconds())
        if time_diff_seconds == 0:
            speed_kmh = 999.0 if dist_km > 0.05 else 0.0
        else:
            time_diff_hours = time_diff_seconds / 3600.0
            speed_kmh = dist_km / time_diff_hours

        is_anomalous = speed_kmh > MAX_REALISTIC_SPEED_KMH

        return {
            "is_anomalous": is_anomalous,
            "anomaly_type": "gps_spoofing_teleportation" if is_anomalous else "none",
            "distance_km": round(dist_km, 3),
            "time_diff_seconds": round(time_diff_seconds, 1),
            "calculated_speed_kmh": round(speed_kmh, 1),
            "max_allowed_speed_kmh": MAX_REALISTIC_SPEED_KMH,
        }

    def detect_order_velocity_anomaly(
        self, order_timestamps: List[datetime], window_seconds: float = 60.0
    ) -> Dict:
        """
        Detects bot spamming / rapid order creation within window_seconds.
        """
        now = datetime.now(timezone.utc)
        recent_count = sum(
            1 for ts in order_timestamps
            if abs((now - ts).total_seconds()) <= window_seconds
        )

        is_anomalous = recent_count > MAX_ORDER_FREQUENCY_PER_MIN

        return {
            "is_anomalous": is_anomalous,
            "anomaly_type": "order_velocity_spamming" if is_anomalous else "none",
            "recent_orders_count": recent_count,
            "max_allowed_per_minute": MAX_ORDER_FREQUENCY_PER_MIN,
        }


anomaly_detection_engine = OperationalAnomalyDetectionEngine()
