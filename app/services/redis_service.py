import time
import logging
from typing import Dict, Optional, Any, Tuple
from redis.asyncio import Redis, from_url

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisService:
    def __init__(self):
        self._client: Optional[Redis] = None
        self._memory_cache: Dict[str, Tuple[str, float]] = {}  # key -> (value, expiry_timestamp)

    async def get_client(self) -> Optional[Redis]:
        """Lazy load and return async Redis client instance."""
        if not settings.REDIS_URL:
            return None

        if self._client is None:
            try:
                self._client = from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                )
                logger.info("Connected to Redis instance successfully.")
            except Exception as e:
                logger.error("Failed to connect to Redis: %s", e)
                return None

        return self._client

    async def set(self, key: str, value: str, expire_seconds: Optional[int] = None) -> bool:
        """Set key-value pair with optional TTL expiration (with in-memory fallback)."""
        client = await self.get_client()
        if not client:
            expiry_ts = time.time() + (expire_seconds or 300)
            self._memory_cache[key] = (value, expiry_ts)
            return True
        try:
            await client.set(key, value, ex=expire_seconds)
            return True
        except Exception as e:
            logger.error("Redis SET failed for key '%s': %s", key, e)
            expiry_ts = time.time() + (expire_seconds or 300)
            self._memory_cache[key] = (value, expiry_ts)
            return False

    async def get(self, key: str) -> Optional[str]:
        """Get value by key (with in-memory fallback)."""
        client = await self.get_client()
        if not client:
            if key in self._memory_cache:
                val, exp = self._memory_cache[key]
                if time.time() < exp:
                    return val
                del self._memory_cache[key]
            return None
        try:
            return await client.get(key)
        except Exception as e:
            logger.error("Redis GET failed for key '%s': %s", key, e)
            if key in self._memory_cache:
                val, exp = self._memory_cache[key]
                if time.time() < exp:
                    return val
    async def delete(self, key: str) -> bool:
        """Delete key from Redis."""

        client = await self.get_client()
        if not client:
            return False
        try:
            await client.delete(key)
            return True
        except Exception as e:
            logger.error("Redis DELETE failed for key '%s': %s", key, e)
            return False

    async def close(self):
        """Close Redis connection pool."""
        if self._client:
            await self._client.aclose()
            self._client = None

    def is_connected(self) -> bool:
        """Check if Redis client instance is initialized."""
        return self._client is not None


redis_service = RedisService()

