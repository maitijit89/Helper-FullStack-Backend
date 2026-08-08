from datetime import datetime, timezone
from typing import List
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class CartItem(BaseModel):
    product_id: str
    product_name: str
    unit_price: float = Field(..., ge=0.0)
    quantity: int = Field(1, ge=1)
    subtotal: float = Field(..., ge=0.0)


class Cart(Document):
    """MongoDB Document model for customer Bucket/Cart."""

    customer_id: Indexed(str, unique=True)
    items: List[CartItem] = Field(default_factory=list)
    items_total: float = Field(0.0, ge=0.0)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "carts"

    def touch(self):
        self.updated_at = datetime.now(timezone.utc)

    def recalculate_total(self):
        """Recalculate subtotal for each item and overall items_total."""
        total = 0.0
        for item in self.items:
            item.subtotal = item.unit_price * item.quantity
            total += item.subtotal
        self.items_total = round(total, 2)
        self.touch()

