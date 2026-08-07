from datetime import datetime
from typing import Annotated, List, Optional
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from app.models.product import ProductCategory

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if v is not None else None)]


class ProductBase(BaseModel):
    name: str
    category: ProductCategory
    description: Optional[str] = None
    price: float = Field(..., ge=0.0)
    unit: str = "item"
    stock_quantity: int = Field(100, ge=0)
    is_available: bool = True
    image_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    search_keywords: List[str] = Field(default_factory=list)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[ProductCategory] = None
    description: Optional[str] = None
    price: Optional[float] = Field(None, ge=0.0)
    unit: Optional[str] = None
    stock_quantity: Optional[int] = Field(None, ge=0)
    is_available: Optional[bool] = None
    image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    search_keywords: Optional[List[str]] = None


class ProductResponse(ProductBase):
    id: PyObjectId = Field(validation_alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )
