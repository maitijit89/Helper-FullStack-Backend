from datetime import datetime
from typing import Annotated, Dict, List, Optional
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from app.models.feedback import FeedbackCategory, FeedbackStatus
from app.schemas.role import UserRole

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if v is not None else None)]


class FeedbackCreate(BaseModel):
    """Payload for customer or delivery partner to submit app feedback."""

    rating: float = Field(..., ge=1.0, le=5.0, description="Star rating between 1.0 and 5.0")
    category: FeedbackCategory = Field(default=FeedbackCategory.GENERAL, description="Feedback category")
    title: Optional[str] = Field(None, max_length=200, description="Short summary or title")
    message: str = Field(..., min_length=3, max_length=2000, description="Detailed feedback, suggestion or bug details")
    app_version: Optional[str] = Field(None, description="App build or version number")
    device_os: Optional[str] = Field(None, description="OS e.g. Android 14, iOS 17, Web")
    device_model: Optional[str] = Field(None, description="Device model e.g. Samsung Galaxy S23, iPhone 15")


class FeedbackAdminPatch(BaseModel):
    """Payload for Admin to triage feedback, add internal notes, and write response."""

    status: Optional[FeedbackStatus] = Field(None, description="Triage status: new, in_review, resolved, archived")
    admin_notes: Optional[str] = Field(None, description="Internal moderation notes")
    admin_response: Optional[str] = Field(None, description="Official response message sent to user")


class FeedbackResponse(BaseModel):
    """Complete feedback response schema."""

    id: PyObjectId = Field(validation_alias="_id")
    user_id: str
    user_name: str
    user_email: str
    user_phone: Optional[str] = None
    role: UserRole
    rating: float
    category: FeedbackCategory
    title: Optional[str] = None
    message: str
    app_version: Optional[str] = None
    device_os: Optional[str] = None
    device_model: Optional[str] = None
    status: FeedbackStatus
    admin_notes: Optional[str] = None
    admin_response: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class FeedbackAnalyticsSummary(BaseModel):
    """Dashboard analytics summary for App Feedback."""

    total_feedback_count: int = 0
    average_rating: float = 5.0
    customer_average_rating: float = 5.0
    partner_average_rating: float = 5.0
    customer_feedback_count: int = 0
    partner_feedback_count: int = 0
    category_breakdown: Dict[str, int] = Field(default_factory=dict)
    status_breakdown: Dict[str, int] = Field(default_factory=dict)
    rating_distribution: Dict[str, int] = Field(default_factory=dict)
