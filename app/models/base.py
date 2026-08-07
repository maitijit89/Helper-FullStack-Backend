from datetime import datetime, timezone
from pydantic import BaseModel, Field


class TimestampMixin(BaseModel):
    """Mixin for adding created_at and updated_at timestamps to Beanie documents."""

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
