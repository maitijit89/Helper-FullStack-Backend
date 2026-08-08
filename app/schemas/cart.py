from datetime import datetime
from typing import Annotated, List, Optional
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from app.models.order import PaymentMethod
from app.schemas.location import GPSLocation

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if v is not None else None)]


class CartItemAdd(BaseModel):
    product_id: str
    quantity: int = Field(1, ge=1)


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=1)


class CartItemResponse(BaseModel):
    product_id: str
    product_name: str
    unit_price: float
    quantity: int
    subtotal: float

    model_config = ConfigDict(from_attributes=True)



class CartResponse(BaseModel):
    id: PyObjectId = Field(validation_alias="_id")
    customer_id: str
    items: List[CartItemResponse] = []
    items_total: float
    min_order_price: float = 10.0
    is_eligible_for_checkout: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class CartCheckoutRequest(BaseModel):
    """Schema for converting items in bucket/cart to an active order."""

    payment_method: PaymentMethod = Field(..., description="upi or cash")
    delivery_address: str = Field(..., description="Street delivery address")
    delivery_location: Optional[GPSLocation] = Field(None, description="GPS location for 1KM radius delivery assignment")
    customer_phone: str = Field(..., description="Customer contact phone number")
    upi_transaction_id: Optional[str] = Field(None, description="UPI reference/transaction ID if payment_method is upi")
