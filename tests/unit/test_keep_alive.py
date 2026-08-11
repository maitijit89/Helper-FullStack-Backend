import asyncio
import pytest
from app.services.keep_alive import (
    start_keep_alive_task,
    stop_keep_alive_task,
)
from app.core.config import settings


@pytest.mark.asyncio
async def test_start_and_stop_keep_alive_task():
    assert settings.ENABLE_KEEP_ALIVE is True

    task = start_keep_alive_task()
    assert task is not None
    assert not task.done()

    # Calling start again returns the same active task instance
    task2 = start_keep_alive_task()
    assert task2 == task

    # Stop task cleanly
    stop_keep_alive_task()
    await asyncio.sleep(0.1)
    assert task.cancelled() or task.done()
