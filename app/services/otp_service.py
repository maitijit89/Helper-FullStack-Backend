from datetime import datetime, timedelta, timezone
import logging
import secrets
from typing import Optional
from app.core.exceptions import BadRequestException
from app.models.otp import OTP
from app.schemas.auth_otp import OTPPurpose
from app.services.email_service import email_service

logger = logging.getLogger(__name__)


class OTPService:
    def _generate_numeric_code(self, length: int = 6) -> str:
        """Generate cryptographically secure 6-digit numeric OTP code."""
        return "".join(secrets.choice("0123456789") for _ in range(length))

    async def create_otp(
        self, email: str, purpose: OTPPurpose
    ) -> tuple[OTP, bool]:
        """Generate, save, and attempt email dispatch of a 6-digit OTP code valid for 10 minutes.
        Returns a tuple of (OTP object, email_sent status boolean)."""
        from app.core.config import settings

        # Rate limiting: prevent spamming OTP requests within 15 seconds (bypassed in testing)
        if settings.ENVIRONMENT != "testing":
            recent_otp = await OTP.find_one(
                OTP.email == email,
                OTP.purpose == purpose,
                OTP.created_at >= datetime.now(timezone.utc) - timedelta(seconds=15),
            )
            if recent_otp:
                raise BadRequestException("Please wait 15 seconds before requesting another OTP.")

        code = self._generate_numeric_code()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        # Invalidate previous unused OTPs for this email and purpose
        existing_otps = await OTP.find(
            OTP.email == email,
            OTP.purpose == purpose,
            OTP.is_used == False,
        ).to_list()
        for old_otp in existing_otps:
            old_otp.is_used = True
            await old_otp.save()

        otp_obj = OTP(
            email=email,
            code=code,
            purpose=purpose,
            expires_at=expires_at,
            is_used=False,
        )
        await otp_obj.insert()

        logger.info(
            "Generated OTP code '%s' for email '%s' (purpose: %s, expires: %s)",
            code,
            email,
            purpose.value,
            expires_at,
        )

        # Send OTP email via Google SMTP
        email_sent = False
        try:
            email_sent = await email_service.send_otp_email(
                to_email=email,
                otp_code=code,
                purpose=purpose.value,
            )
        except Exception as exc:
            logger.error("Error invoking email_service for OTP to '%s': %s", email, exc)

        if not email_sent:
            logger.warning(
                "OTP email dispatch to '%s' failed or was skipped. Dev OTP: %s",
                email,
                code if (settings.DEBUG or settings.ENVIRONMENT == "testing") else "[REDACTED]",
            )

        return otp_obj, email_sent

    async def verify_otp(
        self, email: str, code: str, purpose: OTPPurpose
    ) -> bool:
        """Verify OTP code for given email and purpose with detailed error diagnostics."""
        otp_obj = await OTP.find_one(
            OTP.email == email,
            OTP.code == code,
            OTP.purpose == purpose,
            OTP.is_used == False,
        )
        if not otp_obj:
            # Check if an OTP was already used
            used_otp = await OTP.find_one(
                OTP.email == email,
                OTP.code == code,
                OTP.purpose == purpose,
                OTP.is_used == True,
            )
            if used_otp:
                raise BadRequestException("This OTP code has already been used. Please request a new one.")
            raise BadRequestException("Invalid OTP code. Please check the code and try again.")

        if otp_obj.is_expired:
            raise BadRequestException("OTP code has expired. Please request a new OTP.")

        otp_obj.is_used = True
        await otp_obj.save()
        return True


otp_service = OTPService()
