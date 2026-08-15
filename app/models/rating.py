from datetime import datetime, timezone
from typing import Annotated, List, Optional
from beanie import Document, Indexed
from pydantic import Field


class Rating(Document):
    """MongoDB Document model for partner ratings and reviews submitted by customers."""

    order_id: Annotated[str, Indexed(unique=True)]  # One rating per order
    customer_id: Annotated[str, Indexed()]
    customer_name: Optional[str] = None
    partner_id: Annotated[str, Indexed()]  # User ID of the delivery partner
    rating: float = Field(..., ge=1.0, le=5.0, description="Star rating between 1.0 and 5.0")
    review: Optional[str] = Field(None, description="Optional customer review comment")
    tags: List[str] = Field(
        default_factory=list,
        description="Rating feedback tags, e.g. on_time, polite, careful_handling, fast_delivery",
    )
    is_hidden: bool = Field(False, description="Admin moderation flag to hide inappropriate reviews")
    admin_notes: Optional[str] = Field(None, description="Internal notes from admin regarding moderation")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "ratings"
        indexes = [
            "order_id",
            "customer_id",
            "partner_id",
            [("partner_id", 1), ("is_hidden", 1), ("created_at", -1)],
            [("customer_id", 1), ("created_at", -1)],
            [("rating", -1)],
            [("created_at", -1)],
        ]

    def touch(self):
        """Update updated_at timestamp."""
        self.updated_at = datetime.now(timezone.utc)
