from datetime import datetime, timezone
from beanie import Document, Indexed
from pydantic import Field
from app.schemas.auth_otp import OTPPurpose


class OTP(Document):
    """OTP MongoDB Document model for registration verification and passwordless login."""

    email: Indexed(str)
    code: str
    purpose: OTPPurpose
    expires_at: datetime
    is_used: bool = False
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "otps"

    @property
    def is_expired(self) -> bool:
        """Check if OTP has expired."""
        now = datetime.now(timezone.utc)
        exp = self.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return now > exp
