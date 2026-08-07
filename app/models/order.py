from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from beanie import Document, Indexed
from pydantic import BaseModel, Field
from app.schemas.location import GPSLocation


class OrderType(str, Enum):
    PRODUCT_ORDER = "product_order"
    PRINT_SERVICE = "print_service"
    PORTER_SERVICE = "porter_service"


class OrderStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    ASSIGNED = "assigned"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class OrderItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int = Field(1, ge=1)
    unit_price: float = Field(..., ge=0.0)
    subtotal: float = Field(..., ge=0.0)


class PrintServiceSpec(BaseModel):
    """Specification for Xerox, Printing & Binding services."""

    file_url: Optional[str] = Field(None, description="URL of uploaded document (PDF/Docx)")
    document_name: str = Field("Document", description="Name of document to print")
    num_pages: int = Field(1, ge=1)
    num_copies: int = Field(1, ge=1)
    color_mode: str = Field("black_and_white", description="black_and_white or color")
    paper_size: str = Field("A4", description="A4, A3, Letter")
    is_double_sided: bool = False
    binding_type: str = Field("none", description="none, spiral, channel_file")
    special_instructions: Optional[str] = None


class PorterServiceSpec(BaseModel):
    """Specification for Porter Parcel Courier Service (strictly under 5 kg)."""

    item_description: str = Field(..., description="Description of item/parcel to deliver")
    weight_kg: float = Field(..., le=5.0, gt=0.0, description="Item weight must be 5.0 kg or less")
    pickup_address: str = Field(..., description="Full pickup street address")
    pickup_location: Optional[GPSLocation] = None
    drop_address: str = Field(..., description="Full drop-off street address")
    drop_location: Optional[GPSLocation] = None
    sender_phone: str
    receiver_phone: str
    notes: Optional[str] = None


class Order(Document):
    """MongoDB Document model for Quick-Commerce, Print/Xerox, and Porter (< 5kg) orders."""

    order_id: Indexed(str, unique=True)
    customer_id: str
    partner_id: Optional[str] = None  # Delivery partner assigned
    order_type: OrderType
    status: OrderStatus = OrderStatus.PENDING

    # Specific payload sections
    items: List[OrderItem] = Field(default_factory=list)
    print_spec: Optional[PrintServiceSpec] = None
    porter_spec: Optional[PorterServiceSpec] = None

    # Delivery information
    delivery_address: Optional[str] = None
    delivery_location: Optional[GPSLocation] = None
    customer_phone: Optional[str] = None

    # Financial details
    items_total: float = Field(0.0, ge=0.0)
    delivery_fee: float = Field(0.0, ge=0.0)
    total_amount: float = Field(0.0, ge=0.0)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "orders"

    def touch(self):
        self.updated_at = datetime.now(timezone.utc)
