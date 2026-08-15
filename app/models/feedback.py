from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Optional
from beanie import Document, Indexed
from pydantic import Field
from app.schemas.role import UserRole


class FeedbackStatus(str, Enum):
    NEW = "new"
    IN_REVIEW = "in_review"
    RESOLVED = "resolved"
    ARCHIVED = "archived"


class FeedbackCategory(str, Enum):
    APP_EXPERIENCE = "app_experience"
    DELIVERY_SERVICE = "delivery_service"
    PRICING = "pricing"
    FEATURE_REQUEST = "feature_request"
    BUG_REPORT = "bug_report"
    SUPPORT = "support"
    GENERAL = "general"


class Feedback(Document):
    """MongoDB Document model for App Feedback submitted by Customers and Delivery Partners."""

    user_id: Annotated[str, Indexed()]
    user_name: str
    user_email: str
    user_phone: Optional[str] = None
    role: UserRole = UserRole.USER
    rating: float = Field(..., ge=1.0, le=5.0, description="App satisfaction rating (1.0 to 5.0)")
    category: FeedbackCategory = FeedbackCategory.GENERAL
    title: Optional[str] = Field(None, max_length=200, description="Optional feedback summary or title")
    message: str = Field(..., min_length=3, max_length=2000, description="Detailed feedback or suggestion")

    # Optional client / device telemetry
    app_version: Optional[str] = None
    device_os: Optional[str] = None
    device_model: Optional[str] = None

    # Admin triage & resolution
    status: FeedbackStatus = FeedbackStatus.NEW
    admin_notes: Optional[str] = None
    admin_response: Optional[str] = None

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "feedbacks"
        indexes = [
            "user_id",
            "role",
            "status",
            "category",
            [("role", 1), ("created_at", -1)],
            [("status", 1), ("created_at", -1)],
            [("rating", -1)],
            [("created_at", -1)],
        ]

    def touch(self):
        """Update updated_at timestamp."""
        self.updated_at = datetime.now(timezone.utc)
