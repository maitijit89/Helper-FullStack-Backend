from datetime import datetime
from typing import Annotated, Dict, List, Optional
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if v is not None else None)]


class RatingCreate(BaseModel):
    """Schema for Customer creating a rating for a completed/delivered order."""

    order_id: str = Field(..., description="Unique Order ID of the completed order being rated")
    rating: float = Field(..., ge=1.0, le=5.0, description="Star rating between 1.0 and 5.0")
    review: Optional[str] = Field(None, max_length=1000, description="Customer review text / comments")
    tags: List[str] = Field(
        default_factory=list,
        description="Rating feedback tags (e.g. on_time, polite, careful_handling, fast_delivery)",
    )


class RatingUpdate(BaseModel):
    """Schema for Customer updating / patching their existing rating & review."""

    rating: Optional[float] = Field(None, ge=1.0, le=5.0, description="Updated star rating (1.0 to 5.0)")
    review: Optional[str] = Field(None, max_length=1000, description="Updated customer review comment")
    tags: Optional[List[str]] = Field(None, description="Updated feedback tags")


class AdminRatingPatch(BaseModel):
    """Schema for Admin to moderate or patch any rating entry."""

    rating: Optional[float] = Field(None, ge=1.0, le=5.0, description="Moderated rating score")
    review: Optional[str] = Field(None, description="Moderated review text")
    tags: Optional[List[str]] = Field(None, description="Moderated tags")
    is_hidden: Optional[bool] = Field(None, description="Hide or unhide review from public display")
    admin_notes: Optional[str] = Field(None, description="Internal admin moderation notes")


class AdminPartnerRatingOverride(BaseModel):
    """Schema for Admin to manually set/override a partner's aggregate rating score."""

    rating: float = Field(..., ge=1.0, le=5.0, description="Manual rating score (1.0 - 5.0)")
    total_ratings: Optional[int] = Field(None, ge=0, description="Optional total ratings count")


class RatingResponse(BaseModel):
    """Standard response model for Ratings."""

    id: PyObjectId = Field(validation_alias="_id")
    order_id: str
    customer_id: str
    customer_name: Optional[str] = None
    partner_id: str
    rating: float
    review: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_hidden: bool = False
    admin_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class PartnerRatingSummary(BaseModel):
    """Aggregated rating metrics and recent feedback for a delivery partner."""

    partner_id: str
    average_rating: float = Field(..., description="Average rating score rounded to 2 decimal places")
    total_ratings: int = Field(..., description="Total count of customer ratings received")
    rating_distribution: Dict[str, int] = Field(
        default_factory=lambda: {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0},
        description="Star distribution count from 1 to 5 stars",
    )
    recent_reviews: List[RatingResponse] = Field(
        default_factory=list,
        description="List of recent visible reviews for this partner",
    )
