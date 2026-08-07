from typing import Dict
from fastapi import APIRouter
from app.core.config import settings
from app.core.database import motor_client
from app.models.user import User
from app.schemas.response import APIResponse

router = APIRouter()


@router.get("/health", response_model=APIResponse[Dict[str, str]])
async def health_check():
    """Health check endpoint checking application and MongoDB connectivity."""
    db_status = "healthy"
    try:
        if motor_client is not None:
            await motor_client.admin.command("ping")
        elif User.get_motor_collection() is None:
            db_status = "uninitialized"
    except Exception:
        db_status = "unhealthy"

    return APIResponse(
        success=True,
        message="System health status",
        data={
            "app_name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "status": "online",
            "database": db_status,
        },
    )
