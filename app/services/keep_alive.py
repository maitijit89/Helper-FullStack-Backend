import asyncio
import logging
import os
from typing import Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_keep_alive_task: Optional[asyncio.Task] = None


async def send_keep_alive_ping() -> None:
    """Background loop that periodically pings the server health check endpoint to keep it awake on Render."""
    # Brief initial startup delay to allow FastAPI app server initialization
    await asyncio.sleep(5)

    # Resolve target URL (explicit SERVER_URL > RENDER_EXTERNAL_URL > local fallback)
    target_url = (
        settings.SERVER_URL
        or os.getenv("RENDER_EXTERNAL_URL")
        or f"http://127.0.0.1:{settings.PORT}"
    )
    target_url = target_url.rstrip("/")
    health_endpoint = f"{target_url}{settings.API_V1_STR}/health"

    logger.info(
        f"Starting keep-alive self-ping service. Target: {health_endpoint} (interval: {settings.KEEP_ALIVE_INTERVAL_SECONDS}s)"
    )

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        while True:
            try:
                response = await client.get(health_endpoint)
                if response.status_code == 200:
                    logger.info(f"Keep-alive self-ping successful: {health_endpoint} [HTTP {response.status_code}]")
                else:
                    logger.warning(f"Keep-alive self-ping returned non-200 status: {health_endpoint} [HTTP {response.status_code}]")
            except asyncio.CancelledError:
                logger.info("Keep-alive self-ping loop cancelled.")
                break
            except Exception as exc:
                logger.warning(f"Keep-alive self-ping request failed ({health_endpoint}): {exc}")

            try:
                await asyncio.sleep(settings.KEEP_ALIVE_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                logger.info("Keep-alive self-ping loop cancelled during sleep.")
                break


def start_keep_alive_task() -> Optional[asyncio.Task]:
    """Starts the background keep-alive task if enabled."""
    global _keep_alive_task
    if not settings.ENABLE_KEEP_ALIVE:
        logger.info("Keep-alive service is disabled in settings.")
        return None

    if _keep_alive_task is None or _keep_alive_task.done():
        _keep_alive_task = asyncio.create_task(send_keep_alive_ping())
        logger.info("Keep-alive background task initialized successfully.")

    return _keep_alive_task


def stop_keep_alive_task() -> None:
    """Cancels the background keep-alive task on app shutdown."""
    global _keep_alive_task
    if _keep_alive_task and not _keep_alive_task.done():
        _keep_alive_task.cancel()
        logger.info("Keep-alive background task cancellation requested.")
        _keep_alive_task = None
