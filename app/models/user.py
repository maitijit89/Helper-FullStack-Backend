from datetime import datetime, timezone
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field
from app.schemas.gender import Gender
from app.schemas.location import GPSLocation
from app.schemas.partner import PartnerProfile
from app.schemas.role import UserRole


class User(Document):
    """User MongoDB Document model supporting Customer (User), Partner (Delivery), and Admin roles."""

    email: Indexed(str, unique=True)
    hashed_password: str
    full_name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[Gender] = None
    phone: Optional[str] = None
    college: Optional[str] = None
    address: Optional[str] = None
    role: UserRole = UserRole.USER
    partner_profile: Optional[PartnerProfile] = None
    location: Optional[GPSLocation] = None
    is_gps_enabled: bool = False
    is_email_verified: bool = False
    is_active: bool = True
    is_superuser: bool = False
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "users"

    def touch(self):
        """Update updated_at timestamp."""
        self.updated_at = datetime.now(timezone.utc)
