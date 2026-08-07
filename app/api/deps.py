from typing import List
import jwt
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import ValidationError
from app.core.config import settings
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.crud import user_crud
from app.models.user import User
from app.schemas.partner import PartnerVerificationStatus
from app.schemas.role import UserRole
from app.schemas.token import TokenPayload

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


async def get_current_user(token: str = Depends(reusable_oauth2)) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        if token_data.type != "access":
            raise UnauthorizedException("Invalid token type")
    except (jwt.PyJWTError, ValidationError):
        raise UnauthorizedException("Could not validate credentials")

    if token_data.sub is None:
        raise UnauthorizedException("Token sub claim missing")

    user = await user_crud.get_by_id(user_id=token_data.sub)
    if not user:
        raise UnauthorizedException("User not found")
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise UnauthorizedException("Inactive user account")
    return current_user


def require_roles(allowed_roles: List[UserRole]):
    """Dependency factory for enforcing Role-Based Access Control (RBAC)."""

    async def role_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if current_user.is_superuser:
            return current_user
        if current_user.role not in allowed_roles:
            raise ForbiddenException(
                f"Access forbidden. Requires one of roles: {[r.value for r in allowed_roles]}"
            )
        return current_user

    return role_checker


async def get_current_partner(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Dependency requiring an authenticated and APPROVED delivery partner."""
    if current_user.role != UserRole.PARTNER and not current_user.is_superuser:
        raise ForbiddenException("Access restricted to delivery partners")

    if not current_user.partner_profile:
        raise ForbiddenException("Partner profile missing")

    if current_user.partner_profile.verification_status != PartnerVerificationStatus.APPROVED and not current_user.is_superuser:
        raise ForbiddenException(
            f"Partner account is not approved. Current status: {current_user.partner_profile.verification_status.value}"
        )

    return current_user


async def get_current_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Dependency requiring an authenticated Admin user."""
    if current_user.role != UserRole.ADMIN and not current_user.is_superuser:
        raise ForbiddenException("Access restricted to administrators")
    return current_user


async def require_active_gps(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Dependency requiring active device GPS enabled and valid location coordinates."""
    if not current_user.is_gps_enabled or not current_user.location:
        raise ForbiddenException(
            "GPS / Location services must be enabled on your device to perform this operation."
        )
    return current_user


async def get_current_partner_with_gps(
    current_partner: User = Depends(get_current_partner),
) -> User:
    """Dependency requiring an authenticated and approved delivery partner with active GPS enabled."""
    if not current_partner.is_gps_enabled or not current_partner.location:
        raise ForbiddenException(
            "GPS / Location services must be enabled on your device for delivery partners to access this service."
        )
    return current_partner


