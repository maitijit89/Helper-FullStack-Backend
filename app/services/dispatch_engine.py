import math
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timezone

from app.models.user import User
from app.schemas.location import GPSLocation
from app.schemas.partner import DeliveryMode, PartnerVerificationStatus
from app.schemas.role import UserRole
from app.services.geo_service import calculate_haversine_distance
from app.services.websocket_manager import socket_manager

logger = logging.getLogger(__name__)

# Average speeds in km/h by delivery mode
DELIVERY_MODE_SPEEDS_KMH: Dict[DeliveryMode, float] = {
    DeliveryMode.WALKING: 4.5,
    DeliveryMode.CYCLE: 12.0,

    DeliveryMode.BIKE: 25.0,
    DeliveryMode.SCOOTER: 22.0,
    DeliveryMode.AUTO: 20.0,
    DeliveryMode.CAR: 30.0,
    DeliveryMode.MINI_TRUCK: 25.0,
}


class DispatchEngine:
    """
    Intelligent Delivery Dispatch & Driver Ranking Engine.
    Implements a multi-factor ranking algorithm for matching orders to optimal delivery partners.
    """

    def calculate_eta_minutes(
        self, distance_km: float, mode: DeliveryMode = DeliveryMode.BIKE
    ) -> float:
        """
        Calculate Estimated Time of Arrival (ETA) in minutes based on distance and delivery transport mode.
        Includes a 3-minute handling/pickup buffer time.
        """
        speed_kmh = DELIVERY_MODE_SPEEDS_KMH.get(mode, 20.0)
        travel_time_hours = distance_km / speed_kmh
        travel_time_minutes = travel_time_hours * 60.0
        # Add 3 minutes buffer for traffic signals and partner pickup prep
        total_eta = round(travel_time_minutes + 3.0, 1)
        return max(3.0, total_eta)

    def compute_partner_match_score(
        self,
        distance_km: float,
        rating: float = 4.5,
        acceptance_rate: float = 0.9,
        active_orders_count: int = 0,
        rejection_penalty_count: int = 0,
        max_radius_km: float = 5.0,
    ) -> float:
        """
        Multi-Factor Partner Matching Score Algorithm:
        Score = (W1 * ProximityScore) + (W2 * RatingScore) + (W3 * AcceptanceRate)
                - (W4 * ActiveOrders) - (W5 * RejectionPenalty)

        - ProximityScore: 100 * (1 - distance_km / max_radius_km)
        - RatingScore: 20 * (rating / 5.0)
        - AcceptanceRate: 15 * acceptance_rate
        - ActiveOrders Penalty: -15 * active_orders_count
        - Rejection Penalty: -10 * rejection_penalty_count
        """
        # Proximity score normalized from 0 to 100
        prox_ratio = max(0.0, 1.0 - (distance_km / max(max_radius_km, 0.1)))
        proximity_score = 100.0 * prox_ratio

        rating_score = 20.0 * (min(max(rating, 0.0), 5.0) / 5.0)
        acceptance_score = 15.0 * min(max(acceptance_rate, 0.0), 1.0)
        active_order_penalty = 15.0 * active_orders_count
        rejection_penalty = 10.0 * rejection_penalty_count

        total_score = (
            proximity_score
            + rating_score
            + acceptance_score
            - active_order_penalty
            - rejection_penalty
        )
        return round(max(0.0, total_score), 2)

    async def get_ranked_candidates(
        self,
        pickup_lat: float,
        pickup_lng: float,
        max_radius_km: float = 5.0,
        required_mode: Optional[DeliveryMode] = None,
    ) -> List[Dict]:
        """
        Scan active partners within max_radius_km and return a ranked candidate queue.
        Calculates distance, ETA, and match score for each online, approved partner.
        """
        # Fetch candidate active partners
        partners = await User.find(
            User.role == UserRole.PARTNER,
            User.is_active == True,
            User.is_gps_enabled == True,
        ).to_list()

        active_partner_ids = set(socket_manager.active_connections.keys())
        candidates = []

        for p in partners:
            pid_str = str(p.id)
            profile = p.partner_profile

            if not profile or profile.verification_status != PartnerVerificationStatus.APPROVED:
                continue

            # Check if partner is online
            is_online = pid_str in active_partner_ids or profile.is_online
            if not is_online:
                continue

            # Filter by mode if specified
            if required_mode and getattr(profile, "delivery_mode", None) != required_mode:
                continue

            partner_location: Optional[GPSLocation] = p.location or getattr(profile, "current_location", None)
            if not partner_location:
                continue

            dist_km = calculate_haversine_distance(
                pickup_lat,
                pickup_lng,
                partner_location.latitude,
                partner_location.longitude,
            )

            if dist_km > max_radius_km:
                continue

            mode = getattr(profile, "delivery_mode", DeliveryMode.BIKE)
            rating = getattr(profile, "rating", 4.5)
            acceptance_rate = getattr(profile, "acceptance_rate", 0.95)
            active_orders_count = getattr(profile, "current_active_orders_count", 0)

            eta_min = self.calculate_eta_minutes(dist_km, mode=mode)
            score = self.compute_partner_match_score(
                distance_km=dist_km,
                rating=rating,
                acceptance_rate=acceptance_rate,
                active_orders_count=active_orders_count,
                max_radius_km=max_radius_km,
            )

            candidates.append({
                "partner_id": pid_str,
                "partner": p,
                "distance_km": dist_km,
                "eta_minutes": eta_min,
                "match_score": score,
                "delivery_mode": mode.value if hasattr(mode, "value") else str(mode),
                "rating": rating,
                "latitude": partner_location.latitude,
                "longitude": partner_location.longitude,
            })

        # Sort candidates descending by match score
        candidates.sort(key=lambda x: x["match_score"], reverse=True)
        return candidates


dispatch_engine = DispatchEngine()
