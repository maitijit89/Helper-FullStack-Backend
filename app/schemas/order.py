from datetime import datetime
from typing import Annotated, List, Optional
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from app.models.order import OrderItem, OrderStatus, OrderType, PorterServiceSpec, PrintServiceSpec
from app.schemas.location import GPSLocation

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if v is not None else None)]


class OrderItemRequest(BaseModel):
    product_id: str
    quantity: int = Field(1, ge=1)


class QuickCommerceOrderCreate(BaseModel):
    """Schema for Quick Commerce (cold drinks, snacks, cakes, stationery) orders."""

    items: List[OrderItemRequest] = Field(..., min_length=1)
    delivery_address: str
    delivery_location: Optional[GPSLocation] = None
    customer_phone: str


class PrintOrderCreate(BaseModel):
    """Schema for Xerox, Print & Binding service orders."""

    file_url: Optional[str] = None
    document_name: str = "Document"
    num_pages: int = Field(1, ge=1)
    num_copies: int = Field(1, ge=1)
    color_mode: str = Field("black_and_white", description="black_and_white or color")
    paper_size: str = Field("A4", description="A4 or A3")
    is_double_sided: bool = False
    binding_type: str = Field("none", description="none, spiral, channel_file")
    delivery_address: str
    delivery_location: Optional[GPSLocation] = None
    customer_phone: str
    special_instructions: Optional[str] = None


class PorterOrderCreate(BaseModel):
    """Schema for Porter Parcel Courier Service (strictly under 5 kg)."""

    item_description: str
    weight_kg: float = Field(..., le=5.0, gt=0.0, description="Item weight must be 5.0 kg or less")
    pickup_address: str
    pickup_location: Optional[GPSLocation] = None
    drop_address: str
    drop_location: Optional[GPSLocation] = None
    sender_phone: str
    receiver_phone: str
    notes: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderResponse(BaseModel):
    id: PyObjectId = Field(validation_alias="_id")
    order_id: str
    customer_id: str
    partner_id: Optional[str] = None
    order_type: OrderType
    status: OrderStatus
    items: List[OrderItem] = []
    print_spec: Optional[PrintServiceSpec] = None
    porter_spec: Optional[PorterServiceSpec] = None
    delivery_address: Optional[str] = None
    delivery_location: Optional[GPSLocation] = None
    customer_phone: Optional[str] = None
    items_total: float
    delivery_fee: float
    total_amount: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )
