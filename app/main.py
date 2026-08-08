from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path
import base64
from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles


# Simple inline favicon (32x32 PNG) – base64 encoded
_favicon_data = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABF0lEQVR4nO3XQQrCMBCF4Z+R7EUEUkwTjC6BJCBJigEQrLi3pprtgU+PxsTKkYnx5nvvkGe7yAVxKMZ+eL/7r4R+QH+QQgAkJcCgMVCLF8jHZ6jvceoqM0/3pGAN7iB8C/As6tMKZRnuS7Z+qeVHJIBp7haQ8Vw/+om9e0giVIg9gVbKfAAEkhF8B0dSi2ELToV2PhKOHcl7Kd+mvfce3I+wc6JCNEABAI4AAQQAACCAAABKAiDchG9gAAAAASUVORK5CYII="
)

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(content=_favicon_data, media_type="image/png")
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import close_db, ensure_db_initialized, init_db
from app.core.exceptions import setup_exception_handlers
from app.core.middleware import setup_middlewares
from app.models import (
    OTP,
    Cart,
    Order,
    PartnerWallet,
    Product,
    SupportTicket,
    User,
    WalletTransaction,
    WithdrawalRequest,
)

ALL_MODELS = [
    User,
    OTP,
    Product,
    Order,
    Cart,
    SupportTicket,
    PartnerWallet,
    WalletTransaction,
    WithdrawalRequest,
]



logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for MongoDB & Beanie initialization."""
    logger.info("Initializing MongoDB database connection and Beanie ODM...")
    try:
        await init_db(models=ALL_MODELS)
        logger.info("MongoDB & Beanie initialized successfully.")
    except Exception as exc:
        logger.error("Database lifespan initialization warning: %s", exc)

    # Ensure uploads directory structure exists safely (serverless read-only filesystem handling)
    try:
        Path("uploads/products").mkdir(parents=True, exist_ok=True)
        Path("uploads/print_documents").mkdir(parents=True, exist_ok=True)
    except OSError as err:
        logger.warning("Could not create uploads directory (read-only filesystem on serverless): %s", err)

    yield

    logger.info("Closing MongoDB connection...")
    await close_db()


def create_application() -> FastAPI:
    """FastAPI Application Factory."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=(
            "Production-ready FastAPI backend for Customer Ordering, Delivery Partner Lifecycle, "
            "OTP Authentication, MongoDB (Beanie ODM), AWS S3 Cloud Storage, and Upstash Redis. "
            "Pre-configured for Vercel Serverless Function deployment."
        ),
        contact={
            "name": "Helping Services Team",
            "email": settings.ADMIN_EMAIL,
        },
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Add GZip response compression for responses over 1 KB
    app.add_middleware(GZipMiddleware, minimum_size=1000)


    # Serverless DB initialization fallback middleware (runs on cold starts when lifespan is bypassed)
    @app.middleware("http")
    async def ensure_db_middleware(request: Request, call_next):
        try:
            await ensure_db_initialized(ALL_MODELS)
        except Exception as exc:
            logger.error("DB connection error during request: %s", exc)
        return await call_next(request)

    # Mount Static Files for Uploaded Product Images if directory exists
    try:
        uploads_path = Path("uploads")
        uploads_path.mkdir(parents=True, exist_ok=True)
        app.mount("/static", StaticFiles(directory="uploads"), name="static")
    except OSError as err:
        logger.warning("Mounting static files skipped (read-only filesystem): %s", err)

    # Setup Middlewares & Exception Handlers
    setup_middlewares(app)
    setup_exception_handlers(app)

    # Include Routers
    app.include_router(api_router, prefix=settings.API_V1_STR)

    @app.get("/", tags=["Root"])
    async def root():
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "docs": "/docs",
            "health": f"{settings.API_V1_STR}/health",
            "database": "MongoDB (Beanie ODM)",
        }

    return app


app = create_application()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
