from typing import Any, Dict
from fastapi import APIRouter
from app.core.config import settings
from app.core.database import motor_client
from app.models.user import User
from app.schemas.response import APIResponse
from app.services.redis_service import redis_service

router = APIRouter()


@router.get("/health", response_model=APIResponse[Dict[str, Any]])
async def health_check():
    """Production health check endpoint checking application, MongoDB, Redis, and Storage connectivity."""
    db_status = "healthy"
    try:
        if motor_client is not None:
            await motor_client.admin.command("ping")
        elif User.get_motor_collection() is None:
            db_status = "uninitialized"
    except Exception:
        db_status = "unhealthy"

    # Redis Status Check
    redis_status = "disabled"
    if settings.REDIS_URL:
        redis_status = "healthy" if redis_service.is_connected() else "unhealthy"

    # Storage Status Check
    storage_status = "local"
    if settings.STORAGE_PROVIDER == "s3":
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY and settings.AWS_STORAGE_BUCKET_NAME:
            storage_status = "s3_configured"
        else:
            storage_status = "s3_unconfigured"

    return APIResponse(
        success=True,
        message="System health status",
        data={
            "app_name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "status": "online",
            "database": db_status,
            "redis": redis_status,
            "storage": storage_status,
        },
    )

