import math
from typing import List, Tuple
from app.models.user import User
from app.schemas.partner import PartnerVerificationStatus
from app.schemas.role import UserRole


def calculate_haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """
    Calculate the great circle distance in kilometers between two points 
    on the earth using the Haversine formula.
    """
    R = 6371.0  # Earth's radius in kilometers

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )

    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    distance_km = R * c
    return round(distance_km, 3)


class GeoService:
    async def find_partners_within_radius(
        self,
        customer_lat: float,
        customer_lon: float,
        max_radius_km: float = 1.0,
    ) -> List[Tuple[User, float]]:
        """
        Find active, approved delivery partners who have GPS enabled 
        and are within max_radius_km (default 1.0 KM) from customer's location.
        Returns a list of tuples: (User, distance_km).
        """
        # Fetch candidate active partners with GPS enabled
        candidates = await User.find(
            User.role == UserRole.PARTNER,
            User.is_active == True,
            User.is_gps_enabled == True,
        ).to_list()

        nearby_partners: List[Tuple[User, float]] = []

        for partner in candidates:
            # Must be approved partner
            if (
                not partner.partner_profile
                or partner.partner_profile.verification_status != PartnerVerificationStatus.APPROVED
            ):
                continue

            # Must have valid GPS location
            if not partner.location:
                continue

            dist_km = calculate_haversine_distance(
                customer_lat,
                customer_lon,
                partner.location.latitude,
                partner.location.longitude,
            )

            if dist_km <= max_radius_km:
                nearby_partners.append((partner, dist_km))

        # Sort by proximity (closest partner first)
        nearby_partners.sort(key=lambda item: item[1])
        return nearby_partners


geo_service = GeoService()
