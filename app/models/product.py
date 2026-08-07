from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from beanie import Document, Indexed
from pydantic import Field


class ProductCategory(str, Enum):
    SNACKS = "snacks"
    BEVERAGES = "beverages"
    CAKES = "cakes"
    STATIONERY = "stationery"
    PRINTING = "printing"
    PORTER_5KG = "porter_5kg"


class Product(Document):
    """MongoDB Document model for Quick-Commerce Products & Services."""

    name: Indexed(str)
    category: ProductCategory
    description: Optional[str] = None
    price: float = Field(..., ge=0.0, description="Price in INR")
    unit: str = Field("item", description="Unit of measurement e.g. item, page, pack, trip")
    stock_quantity: int = Field(100, ge=0, description="Available stock quantity")
    is_available: bool = True
    image_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    search_keywords: List[str] = Field(default_factory=list)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "products"

    def touch(self):
        self.updated_at = datetime.now(timezone.utc)
