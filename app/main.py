from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import close_db, init_db
from app.core.exceptions import setup_exception_handlers
from app.core.middleware import setup_middlewares
from app.models import OTP, Order, Product, User

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for MongoDB & Beanie initialization."""
    logger.info("Initializing MongoDB database connection and Beanie ODM...")
    await init_db(models=[User, OTP, Product, Order])
    logger.info("MongoDB & Beanie initialized successfully with User, OTP, Product and Order document models.")

    # Ensure uploads directory structure exists
    uploads_dir = Path("uploads/products")
    uploads_dir.mkdir(parents=True, exist_ok=True)

    yield

    logger.info("Closing MongoDB connection...")
    await close_db()


def create_application() -> FastAPI:
    """FastAPI Application Factory."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Mount Static Files for Uploaded Product Images
    uploads_path = Path("uploads")
    uploads_path.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory="uploads"), name="static")

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
