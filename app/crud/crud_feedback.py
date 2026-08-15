import logging
from typing import Dict, List, Optional
from beanie import PydanticObjectId
from app.core.exceptions import NotFoundException
from app.models.feedback import Feedback, FeedbackCategory, FeedbackStatus
from app.models.user import User
from app.schemas.feedback import (
    FeedbackAdminPatch,
    FeedbackAnalyticsSummary,
    FeedbackCreate,
)
from app.schemas.role import UserRole

logger = logging.getLogger(__name__)


class CRUDFeedback:
    """CRUD operations and analytics calculations for User & Partner App Feedback."""

    async def get_by_id(self, feedback_id: str) -> Optional[Feedback]:
        """Retrieve feedback by string ID or ObjectId."""
        try:
            f = await Feedback.get(PydanticObjectId(feedback_id))
            if f:
                return f
            return await Feedback.get(feedback_id)
        except Exception:
            try:
                return await Feedback.get(feedback_id)
            except Exception:
                return None

    async def create_feedback(self, user: User, obj_in: FeedbackCreate) -> Feedback:
        """Create new app feedback submitted by Customer or Delivery Partner."""
        phone = user.phone
        if not phone and user.partner_profile:
            phone = getattr(user.partner_profile, "phone", None)

        feedback_doc = Feedback(
            user_id=str(user.id),
            user_name=user.full_name or ("Partner" if user.role == UserRole.PARTNER else "Customer"),
            user_email=user.email,
            user_phone=phone,
            role=user.role,
            rating=round(float(obj_in.rating), 2),
            category=obj_in.category,
            title=obj_in.title.strip() if obj_in.title else None,
            message=obj_in.message.strip(),
            app_version=obj_in.app_version,
            device_os=obj_in.device_os,
            device_model=obj_in.device_model,
            status=FeedbackStatus.NEW,
            admin_notes=None,
            admin_response=None,
        )
        await feedback_doc.insert()
        logger.info(
            "Created app feedback %s (%.1f stars) from %s '%s' [Category: %s]",
            str(feedback_doc.id),
            feedback_doc.rating,
            user.role.value,
            user.email,
            feedback_doc.category.value,
        )
        return feedback_doc

    async def get_user_feedback(
        self, user_id: str, skip: int = 0, limit: int = 50
    ) -> List[Feedback]:
        """Fetch all feedback submissions by a specific user or partner."""
        return (
            await Feedback.find(Feedback.user_id == user_id)
            .sort("-created_at")
            .skip(skip)
            .limit(limit)
            .to_list()
        )

    async def get_all_feedback(
        self,
        role: Optional[UserRole] = None,
        category: Optional[FeedbackCategory] = None,
        status: Optional[FeedbackStatus] = None,
        min_rating: Optional[float] = None,
        max_rating: Optional[float] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Feedback]:
        """Fetch feedback across platform with multi-parameter filtering for Admin."""
        query = Feedback.find_all()
        if role:
            query = query.find(Feedback.role == role)
        if category:
            query = query.find(Feedback.category == category)
        if status:
            query = query.find(Feedback.status == status)
        if min_rating is not None:
            query = query.find(Feedback.rating >= min_rating)
        if max_rating is not None:
            query = query.find(Feedback.rating <= max_rating)

        return await query.sort("-created_at").skip(skip).limit(limit).to_list()

    async def admin_patch_feedback(
        self, feedback_id: str, obj_in: FeedbackAdminPatch
    ) -> Feedback:
        """Admin updates feedback status, notes, or response message."""
        doc = await self.get_by_id(feedback_id)
        if not doc:
            raise NotFoundException("Feedback entry not found.")

        if obj_in.status is not None:
            doc.status = obj_in.status
        if obj_in.admin_notes is not None:
            doc.admin_notes = obj_in.admin_notes
        if obj_in.admin_response is not None:
            doc.admin_response = obj_in.admin_response

        doc.touch()
        await doc.save()
        return doc

    async def delete_feedback(self, feedback_id: str) -> bool:
        """Delete feedback entry."""
        doc = await self.get_by_id(feedback_id)
        if not doc:
            raise NotFoundException("Feedback entry not found.")

        await doc.delete()
        return True

    async def get_feedback_analytics(self) -> FeedbackAnalyticsSummary:
        """Compute aggregated feedback statistics for Admin Dashboard."""
        all_feedbacks = await Feedback.find_all().to_list()
        total = len(all_feedbacks)

        category_counts: Dict[str, int] = {c.value: 0 for c in FeedbackCategory}
        status_counts: Dict[str, int] = {s.value: 0 for s in FeedbackStatus}
        rating_dist: Dict[str, int] = {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}

        customer_ratings = []
        partner_ratings = []

        for f in all_feedbacks:
            # Category counts
            cat_key = f.category.value if hasattr(f.category, "value") else str(f.category)
            category_counts[cat_key] = category_counts.get(cat_key, 0) + 1

            # Status counts
            st_key = f.status.value if hasattr(f.status, "value") else str(f.status)
            status_counts[st_key] = status_counts.get(st_key, 0) + 1

            # Star distribution
            star_bucket = str(min(5, max(1, round(f.rating))))
            rating_dist[star_bucket] = rating_dist.get(star_bucket, 0) + 1

            # Role breakdown
            if f.role == UserRole.PARTNER:
                partner_ratings.append(f.rating)
            else:
                customer_ratings.append(f.rating)

        avg_total = round(sum(f.rating for f in all_feedbacks) / total, 2) if total > 0 else 5.0
        avg_cust = (
            round(sum(customer_ratings) / len(customer_ratings), 2)
            if customer_ratings
            else 5.0
        )
        avg_part = (
            round(sum(partner_ratings) / len(partner_ratings), 2)
            if partner_ratings
            else 5.0
        )

        return FeedbackAnalyticsSummary(
            total_feedback_count=total,
            average_rating=avg_total,
            customer_average_rating=avg_cust,
            partner_average_rating=avg_part,
            customer_feedback_count=len(customer_ratings),
            partner_feedback_count=len(partner_ratings),
            category_breakdown=category_counts,
            status_breakdown=status_counts,
            rating_distribution=rating_dist,
        )


feedback_crud = CRUDFeedback()
