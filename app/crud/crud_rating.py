import logging
from typing import Dict, List, Optional
from beanie import PydanticObjectId
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.order import Order, OrderStatus
from app.models.rating import Rating
from app.models.user import User
from app.schemas.rating import (
    AdminPartnerRatingOverride,
    AdminRatingPatch,
    PartnerRatingSummary,
    RatingCreate,
    RatingResponse,
    RatingUpdate,
)

logger = logging.getLogger(__name__)


class CRUDRating:
    """CRUD operations for Customer-Partner Ratings & Reviews."""

    async def get_by_id(self, rating_id: str) -> Optional[Rating]:
        """Fetch rating by string ID or PydanticObjectId."""
        try:
            r = await Rating.get(PydanticObjectId(rating_id))
            if r:
                return r
            return await Rating.get(rating_id)
        except Exception:
            try:
                return await Rating.get(rating_id)
            except Exception:
                return None

    async def get_by_order_id(self, order_id: str) -> Optional[Rating]:
        """Fetch rating by unique Order ID."""
        return await Rating.find_one(Rating.order_id == order_id)

    async def create_rating(self, customer: User, obj_in: RatingCreate) -> Rating:
        """
        Customer rates delivery partner for a completed/delivered order.
        Validates order ownership, delivery completion, and ensures single rating per order.
        Automatically updates Order status and recalculates partner aggregate rating metrics.
        """
        # 1. Fetch Order
        order = await Order.find_one(Order.order_id == obj_in.order_id)
        if not order:
            raise NotFoundException(f"Order '{obj_in.order_id}' not found.")

        # 2. Check customer ownership
        customer_id_str = str(customer.id)
        if order.customer_id != customer_id_str:
            raise ForbiddenException("You are only authorized to rate your own orders.")

        # 3. Check order completion status
        if order.status != OrderStatus.DELIVERED:
            raise BadRequestException(
                f"You can only rate delivered orders. Current order status is '{order.status.value}'."
            )

        # 4. Check partner assignment
        if not order.partner_id:
            raise BadRequestException("Cannot rate an order that has no delivery partner assigned.")

        # 5. Check if already rated
        existing_rating = await self.get_by_order_id(order_id=obj_in.order_id)
        if existing_rating or order.is_rated:
            raise BadRequestException("This order has already been rated. You can update your existing rating instead.")

        # 6. Create Rating document
        rating_doc = Rating(
            order_id=order.order_id,
            customer_id=customer_id_str,
            customer_name=customer.full_name or "Customer",
            partner_id=order.partner_id,
            rating=round(float(obj_in.rating), 2),
            review=obj_in.review.strip() if obj_in.review else None,
            tags=obj_in.tags or [],
            is_hidden=False,
            admin_notes=None,
        )
        await rating_doc.insert()

        # 7. Update Order
        order.is_rated = True
        order.rating = rating_doc.rating
        order.review = rating_doc.review
        order.touch()
        await order.save()

        # 8. Recalculate partner metrics
        await self.recalculate_partner_rating(partner_id=order.partner_id)

        logger.info(
            "Created rating %s (%.1f stars) for partner %s by customer %s on order %s",
            str(rating_doc.id),
            rating_doc.rating,
            order.partner_id,
            customer_id_str,
            order.order_id,
        )
        return rating_doc

    async def update_customer_rating(
        self, rating_id: str, customer_id: str, obj_in: RatingUpdate
    ) -> Rating:
        """Allow customer to update/patch their rating and feedback."""
        rating_doc = await self.get_by_id(rating_id)
        if not rating_doc:
            raise NotFoundException("Rating not found.")

        if rating_doc.customer_id != customer_id:
            raise ForbiddenException("You are not authorized to update this rating.")

        if obj_in.rating is not None:
            rating_doc.rating = round(float(obj_in.rating), 2)
            # Update corresponding order
            order = await Order.find_one(Order.order_id == rating_doc.order_id)
            if order:
                order.rating = rating_doc.rating
                if obj_in.review is not None:
                    order.review = obj_in.review.strip() if obj_in.review else None
                order.touch()
                await order.save()

        if obj_in.review is not None:
            rating_doc.review = obj_in.review.strip() if obj_in.review else None

        if obj_in.tags is not None:
            rating_doc.tags = obj_in.tags

        rating_doc.touch()
        await rating_doc.save()

        # Recalculate partner metrics
        await self.recalculate_partner_rating(partner_id=rating_doc.partner_id)
        return rating_doc

    async def admin_patch_rating(
        self, rating_id: str, obj_in: AdminRatingPatch
    ) -> Rating:
        """Allow Admin to moderate, patch, hide/unhide, or add notes to any rating."""
        rating_doc = await self.get_by_id(rating_id)
        if not rating_doc:
            raise NotFoundException("Rating not found.")

        if obj_in.rating is not None:
            rating_doc.rating = round(float(obj_in.rating), 2)
            order = await Order.find_one(Order.order_id == rating_doc.order_id)
            if order:
                order.rating = rating_doc.rating
                if obj_in.review is not None:
                    order.review = obj_in.review.strip() if obj_in.review else None
                order.touch()
                await order.save()

        if obj_in.review is not None:
            rating_doc.review = obj_in.review.strip() if obj_in.review else None

        if obj_in.tags is not None:
            rating_doc.tags = obj_in.tags

        if obj_in.is_hidden is not None:
            rating_doc.is_hidden = obj_in.is_hidden

        if obj_in.admin_notes is not None:
            rating_doc.admin_notes = obj_in.admin_notes

        rating_doc.touch()
        await rating_doc.save()

        # Recalculate partner metrics taking visibility into account
        await self.recalculate_partner_rating(partner_id=rating_doc.partner_id)
        return rating_doc

    async def admin_delete_rating(self, rating_id: str) -> bool:
        """Admin deletes a rating (e.g. offensive/spam) and updates partner & order stats."""
        rating_doc = await self.get_by_id(rating_id)
        if not rating_doc:
            raise NotFoundException("Rating not found.")

        partner_id = rating_doc.partner_id
        order_id = rating_doc.order_id

        # Update order
        order = await Order.find_one(Order.order_id == order_id)
        if order:
            order.is_rated = False
            order.rating = None
            order.review = None
            order.touch()
            await order.save()

        await rating_doc.delete()
        await self.recalculate_partner_rating(partner_id=partner_id)
        return True

    async def get_my_ratings(
        self, customer_id: str, skip: int = 0, limit: int = 50
    ) -> List[Rating]:
        """Fetch all ratings submitted by a specific customer."""
        return (
            await Rating.find(Rating.customer_id == customer_id)
            .sort("-created_at")
            .skip(skip)
            .limit(limit)
            .to_list()
        )

    async def get_partner_ratings(
        self, partner_id: str, include_hidden: bool = False, skip: int = 0, limit: int = 50
    ) -> List[Rating]:
        """Fetch all ratings received by a partner."""
        query = Rating.find(Rating.partner_id == partner_id)
        if not include_hidden:
            query = query.find(Rating.is_hidden == False)
        return await query.sort("-created_at").skip(skip).limit(limit).to_list()

    async def get_partner_rating_summary(self, partner_id: str) -> PartnerRatingSummary:
        """Compute average rating score, total count, star distribution, and recent visible reviews."""
        all_ratings = await Rating.find(
            Rating.partner_id == partner_id,
            Rating.is_hidden == False,
        ).sort("-created_at").to_list()

        total = len(all_ratings)
        distribution: Dict[str, int] = {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}

        if total > 0:
            rating_sum = sum(r.rating for r in all_ratings)
            avg_score = round(rating_sum / total, 2)
            for r in all_ratings:
                star_bucket = str(min(5, max(1, round(r.rating))))
                distribution[star_bucket] = distribution.get(star_bucket, 0) + 1
        else:
            avg_score = 5.0

        recent = all_ratings[:10]
        recent_responses = [RatingResponse.model_validate(r) for r in recent]

        return PartnerRatingSummary(
            partner_id=partner_id,
            average_rating=avg_score,
            total_ratings=total,
            rating_distribution=distribution,
            recent_reviews=recent_responses,
        )

    async def recalculate_partner_rating(self, partner_id: str) -> Optional[User]:
        """Recalculate partner's aggregate rating score and total count based on visible reviews."""
        try:
            partner = await User.get(PydanticObjectId(partner_id))
        except Exception:
            partner = await User.get(partner_id)

        if not partner:
            # Also try matching partner_profile.partner_id
            partner = await User.find_one(User.partner_profile.partner_id == partner_id)

        if not partner or not partner.partner_profile:
            return None

        visible_ratings = await Rating.find(
            Rating.partner_id == str(partner.id),
            Rating.is_hidden == False,
        ).to_list()

        total_count = len(visible_ratings)
        if total_count > 0:
            rating_sum = sum(r.rating for r in visible_ratings)
            avg_rating = round(rating_sum / total_count, 2)
            partner.partner_profile.total_ratings = total_count
            partner.partner_profile.rating_sum = rating_sum
            partner.partner_profile.rating = avg_rating
        else:
            partner.partner_profile.total_ratings = 0
            partner.partner_profile.rating_sum = 0.0
            partner.partner_profile.rating = 5.0

        partner.touch()
        await partner.save()
        return partner

    async def list_all_ratings(
        self,
        partner_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        min_rating: Optional[float] = None,
        max_rating: Optional[float] = None,
        is_hidden: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Rating]:
        """List ratings with comprehensive filtering for Admin."""
        query = Rating.find_all()
        if partner_id:
            query = query.find(Rating.partner_id == partner_id)
        if customer_id:
            query = query.find(Rating.customer_id == customer_id)
        if is_hidden is not None:
            query = query.find(Rating.is_hidden == is_hidden)
        if min_rating is not None:
            query = query.find(Rating.rating >= min_rating)
        if max_rating is not None:
            query = query.find(Rating.rating <= max_rating)

        return await query.sort("-created_at").skip(skip).limit(limit).to_list()

    async def admin_override_partner_rating(
        self, partner_id: str, obj_in: AdminPartnerRatingOverride
    ) -> Optional[User]:
        """Admin directly overrides partner aggregate rating."""
        try:
            partner = await User.get(PydanticObjectId(partner_id))
        except Exception:
            partner = await User.get(partner_id)

        if not partner:
            partner = await User.find_one(User.partner_profile.partner_id == partner_id)

        if not partner or not partner.partner_profile:
            raise NotFoundException("Delivery partner not found.")

        partner.partner_profile.rating = round(float(obj_in.rating), 2)
        if obj_in.total_ratings is not None:
            partner.partner_profile.total_ratings = obj_in.total_ratings
            partner.partner_profile.rating_sum = round(obj_in.rating * obj_in.total_ratings, 2)

        partner.touch()
        await partner.save()
        return partner


rating_crud = CRUDRating()
