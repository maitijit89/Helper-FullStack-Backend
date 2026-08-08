import logging
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger(__name__)

# Global Motor client instance & initialization state
motor_client: AsyncIOMotorClient | None = None
is_initialized: bool = False


async def init_db(models: list):
    """Initialize MongoDB connection and Beanie ODM models."""
    global motor_client, is_initialized
    if is_initialized and motor_client is not None:
        logger.debug("Database already initialized, skipping initialization.")
        return

    logger.info("Connecting to MongoDB at %s...", settings.MONGODB_URL)
    motor_client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=5000,
    )
    database = motor_client[settings.MONGODB_DB_NAME]

    await init_beanie(
        database=database,
        document_models=models,
    )
    is_initialized = True
    logger.info("Successfully connected to MongoDB database '%s'", settings.MONGODB_DB_NAME)


async def ensure_db_initialized(models: list):
    """Ensure DB connection and Beanie ODM are initialized before handling requests."""
    global is_initialized
    if not is_initialized:
        await init_db(models)


async def close_db():
    """Close MongoDB Motor client connection."""
    global motor_client, is_initialized
    if motor_client:
        motor_client.close()
        motor_client = None
        is_initialized = False
        logger.info("MongoDB client connection closed.")

