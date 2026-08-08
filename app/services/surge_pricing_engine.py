import math
import logging
from typing import Dict, Optional
from datetime import datetime, timezone

from app.models.order import Order, OrderStatus
from app.models.user import User
from app.schemas.role import UserRole
from app.services.geo_service import calculate_haversine_distance
from app.services.websocket_manager import socket_manager

logger = logging.getLogger(__name__)


class SurgePricingEngine:
    """
    Dynamic Demand-Supply Surge Pricing Engine.
    Calculates localized surge multipliers based on real-time active order density 
    vs available online partner supply within a geofence radius.
    """

    async def calculate_surge_multiplier(
        self,
        customer_lat: float,
        customer_lng: float,
        radius_km: float = 3.0,
    ) -> Dict:
        """
        Geofenced Surge Multiplier Algorithm:
        Surge Multiplier = 1.0 + Min(1.5, Max(0.0, (Active Orders - 1.2 * Available Partners) / (Available Partners + 1)) * 0.25)

        - Base Multiplier: 1.0x (No surge)
        - Max Multiplier: 2.5x
        """
        # Fetch active online partners
        all_partners = await User.find(
            User.role == UserRole.PARTNER,
            User.is_active == True,
            User.is_gps_enabled == True,
        ).to_list()

        active_partner_ids = set(socket_manager.active_connections.keys())
        available_partners_count = 0

        for p in all_partners:
            profile = p.partner_profile
            if not profile or not profile.is_online:
                if str(p.id) not in active_partner_ids:
                    continue

            p_loc = p.location or getattr(profile, "current_location", None)
            if not p_loc:
                continue

            dist = calculate_haversine_distance(customer_lat, customer_lng, p_loc.latitude, p_loc.longitude)
            if dist <= radius_km:
                available_partners_count += 1

        # Fetch active pending/ringing orders today
        active_orders = await Order.find(
            Order.status == OrderStatus.PENDING
        ).to_list()

        active_orders_count = len(active_orders)

        # Apply Surge Calculation Algorithm
        if available_partners_count == 0 and active_orders_count > 0:
            surge_multiplier = 1.5  # High surge baseline when no drivers nearby
            surge_reason = "High demand & low partner availability in your area"
        else:
            ratio_excess = (active_orders_count - (1.2 * available_partners_count)) / (available_partners_count + 1)
            additional_surge = max(0.0, ratio_excess) * 0.25
            surge_multiplier = round(1.0 + min(1.5, additional_surge), 2)
            
            if surge_multiplier > 1.2:
                surge_reason = "High order volume in your area"
            elif surge_multiplier > 1.0:
                surge_reason = "Moderate demand surge"
            else:
                surge_reason = "Normal demand"

        return {
            "surge_multiplier": surge_multiplier,
            "surge_reason": surge_reason,
            "available_partners_count": available_partners_count,
            "active_orders_count": active_orders_count,
            "radius_km": radius_km,
            "is_surge_active": surge_multiplier > 1.0,
        }

    def apply_surge_to_delivery_fee(
        self, base_delivery_fee: float, surge_multiplier: float
    ) -> float:
        """Apply surge multiplier to base delivery fee rounded to nearest INR."""
        if surge_multiplier <= 1.0:
            return round(base_delivery_fee, 2)
        surged_fee = base_delivery_fee * surge_multiplier
        return round(surged_fee, 2)


surge_pricing_engine = SurgePricingEngine()
