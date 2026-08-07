from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class GPSLocation(BaseModel):
    """GPS Location data model."""

    latitude: float = Field(..., description="Latitude coordinate between -90.0 and 90.0")
    longitude: float = Field(..., description="Longitude coordinate between -180.0 and 180.0")
    is_gps_enabled: bool = Field(True, description="Status indicating whether device GPS is currently ON")
    address: Optional[str] = Field(None, description="Reverse-geocoded location address string")
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of last GPS location signal",
    )


class LocationUpdate(BaseModel):
    """Schema for updating user or partner GPS location."""

    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate")
    is_gps_enabled: bool = Field(..., description="Device GPS state must be sent with location update")
    address: Optional[str] = Field(None, description="Optional street address or landmark")

    @field_validator("is_gps_enabled")
    @classmethod
    def validate_gps_enabled(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Device GPS must be enabled to send location updates.")
        return v
