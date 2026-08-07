import logging
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger(__name__)

# Global Motor client instance
motor_client: AsyncIOMotorClient | None = None


async def init_db(models: list):
    """Initialize MongoDB connection and Beanie ODM models."""
    global motor_client
    logger.info("Connecting to MongoDB at %s...", settings.MONGODB_URL)
    motor_client = AsyncIOMotorClient(settings.MONGODB_URL)
    database = motor_client[settings.MONGODB_DB_NAME]

    await init_beanie(
        database=database,
        document_models=models,
    )
    logger.info("Successfully connected to MongoDB database '%s'", settings.MONGODB_DB_NAME)


async def close_db():
    """Close MongoDB Motor client connection."""
    global motor_client
    if motor_client:
        motor_client.close()
        logger.info("MongoDB client connection closed.")
