from typing import Any
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
import jwt
from app.api.deps import get_current_active_user
from app.core.config import settings
from app.core.exceptions import UnauthorizedException
from app.core.security import create_access_token, create_refresh_token
from app.models.user import User
from app.schemas.auth_otp import (
    OTPPurpose,
    OTPRequest,
    OTPResponse,
    OTPVerifyRequest,
)
from app.schemas.partner import PartnerCreate, PartnerLoginRequest
from app.schemas.response import APIResponse
from app.schemas.token import Token, TokenPayload
from app.schemas.user import CustomerUserCreate, UserResponse
from app.services.auth_service import auth_service
from app.services.partner_service import partner_service

router = APIRouter()


@router.post(
    "/signup/user",
    response_model=APIResponse[OTPResponse],
    status_code=status.HTTP_201_CREATED,
)
async def signup_customer_user(user_in: CustomerUserCreate) -> Any:
    """Register a new customer with Name, DOB, Gender, Email, Phone, College, and Address. Generates email verification OTP."""
    user, otp = await auth_service.register_customer(user_in=user_in)
    return APIResponse(
        success=True,
        message="Registration successful. Verification OTP sent to your email.",
        data=OTPResponse(
            email=user.email,
            message="Verification OTP sent",
            dev_otp=otp.code if settings.DEBUG else None,
        ),
    )


@router.post("/verify-otp", response_model=APIResponse[Token])
async def verify_registration_otp(req: OTPVerifyRequest) -> Any:
    """Verify email registration OTP and issue JWT access tokens to enter the app."""
    tokens = await auth_service.verify_registration_otp(
        email=req.email, code=req.otp
    )
    return APIResponse(
        success=True,
        message="Email verified successfully. Welcome to the application!",
        data=tokens,
    )


@router.post("/admin/request-otp", response_model=APIResponse[OTPResponse])
async def request_admin_otp(req: OTPRequest) -> Any:
    """Request Admin login OTP (Restricted exclusively to helpingservicesteam@gmail.com)."""
    otp = await auth_service.request_admin_otp(email=req.email)
    return APIResponse(
        success=True,
        message=f"Admin login OTP sent to {settings.ADMIN_EMAIL}.",
        data=OTPResponse(
            email=req.email,
            message="Admin OTP sent",
            dev_otp=otp.code if settings.DEBUG else None,
        ),
    )


@router.post("/admin/verify-otp", response_model=APIResponse[Token])
async def verify_admin_otp(req: OTPVerifyRequest) -> Any:
    """Verify Admin login OTP and issue Admin JWT access tokens."""
    tokens = await auth_service.verify_admin_otp(
        email=req.email, code=req.otp
    )
    return APIResponse(
        success=True,
        message="Admin authentication successful. Welcome Administrator!",
        data=tokens,
    )


@router.post("/login/request-otp", response_model=APIResponse[OTPResponse])
async def request_login_otp(req: OTPRequest) -> Any:
    """Request a 6-digit login OTP for passwordless login into the app."""
    otp = await auth_service.request_login_otp(email=req.email)
    return APIResponse(
        success=True,
        message="Login OTP sent to your registered email.",
        data=OTPResponse(
            email=req.email,
            message="Login OTP sent",
            dev_otp=otp.code if settings.DEBUG else None,
        ),
    )


@router.post("/login/verify-otp", response_model=APIResponse[Token])
async def verify_login_otp(req: OTPVerifyRequest) -> Any:
    """Verify login OTP and issue JWT access tokens for immediate app access."""
    tokens = await auth_service.verify_login_otp(
        email=req.email, code=req.otp
    )
    return APIResponse(
        success=True,
        message="Login successful. Welcome back!",
        data=tokens,
    )


@router.post("/resend-otp", response_model=APIResponse[OTPResponse])
async def resend_otp(req: OTPRequest, purpose: OTPPurpose = OTPPurpose.VERIFICATION) -> Any:
    """Resend a new OTP for email verification or login."""
    otp = await auth_service.resend_otp(email=req.email, purpose=purpose)
    return APIResponse(
        success=True,
        message="A new OTP code has been sent.",
        data=OTPResponse(
            email=req.email,
            message="New OTP sent",
            dev_otp=otp.code if settings.DEBUG else None,
        ),
    )


@router.post("/logout", response_model=APIResponse[dict])
async def logout(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Logout current user session."""
    return APIResponse(
        success=True,
        message="Logout successful.",
        data={"status": "logged_out"},
    )


@router.post(
    "/signup/partner",
    response_model=APIResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
)
async def signup_partner(partner_in: PartnerCreate) -> Any:
    """Apply as a delivery partner (Preferred mode: Cycle or Walking). One application per week."""
    partner = await partner_service.apply_partner(partner_in=partner_in)
    return APIResponse(
        success=True,
        message="Delivery partner application submitted successfully. Awaiting Admin review.",
        data=UserResponse.model_validate(partner),
    )


@router.post("/partner/login", response_model=APIResponse[Token])
async def partner_login(req: PartnerLoginRequest) -> Any:
    """Delivery partner login using Partner ID (e.g. PRT-892134) or registered Email."""
    tokens = await partner_service.authenticate_partner(
        partner_id_or_email=req.partner_id_or_email, password=req.password
    )
    return APIResponse(
        success=True,
        message="Delivery partner login successful.",
        data=tokens,
    )


@router.post("/login", response_model=Token)
async def login_password_fallback(
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """Password-based OAuth2 token login fallback."""
    token = await auth_service.authenticate_user(
        email=form_data.username, password=form_data.password
    )
    return token


@router.post("/refresh", response_model=Token)
async def refresh_token(refresh_token_str: str) -> Any:
    """Obtain a new access token using a valid refresh token."""
    try:
        payload = jwt.decode(
            refresh_token_str, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        if token_data.type != "refresh" or not token_data.sub:
            raise UnauthorizedException("Invalid refresh token")
    except (jwt.PyJWTError, Exception):
        raise UnauthorizedException("Invalid refresh token")

    new_access_token = create_access_token(
        subject=token_data.sub, role=token_data.role
    )
    new_refresh_token = create_refresh_token(
        subject=token_data.sub, role=token_data.role
    )
    return Token(access_token=new_access_token, refresh_token=new_refresh_token)
