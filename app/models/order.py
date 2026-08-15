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
    ASSIGNMENT_WRITER = "assignment_writer"


class OrderStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    ASSIGNED = "assigned"
    DOCUMENT_PICKED_UP = "document_picked_up"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    UPI = "upi"
    CASH = "cash"
    RAZORPAY = "razorpay"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    CASH_ON_DELIVERY = "cash_on_delivery"
    FAILED = "failed"



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
    is_physical_pickup: bool = Field(False, description="True if partner physically picks up hardcopy document from customer for Xerox")
    num_pages: int = Field(1, ge=1)
    num_copies: int = Field(1, ge=1)
    color_mode: str = Field("black_and_white", description="black_and_white or color")
    paper_size: str = Field("A4", description="A4, A3, Letter")
    is_double_sided: bool = False
    binding_type: str = Field("none", description="none, spiral, channel_file")
    special_instructions: Optional[str] = None


class AssignmentServiceSpec(BaseModel):
    """Specification for Handwritten Assignment Writer services."""

    file_url: Optional[str] = Field(None, description="URL of reference uploaded document/images")
    document_name: str = Field("Assignment", description="Name or topic of assignment")
    is_physical_pickup: bool = Field(False, description="True if partner physically picks up notebook/pages/hardcopy notes from customer")
    num_pages: int = Field(1, ge=1, description="Number of pages to be handwritten")
    paper_type: str = Field("a4_ruled", description="a4_ruled, a4_unruled, practical_sheet")
    binding_type: str = Field("none", description="none (loose paper), spiral (spiral file), channel_file (channel file)")
    ink_color: str = Field("blue", description="blue, black, blue_black, multicolor")
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
    """MongoDB Document model for Quick-Commerce, Print/Xerox, Porter (< 5kg), and Assignment Writer orders."""

    order_id: Indexed(str, unique=True)
    customer_id: str
    partner_id: Optional[str] = None  # Delivery partner assigned
    order_type: OrderType
    status: OrderStatus = OrderStatus.PENDING

    # Specific payload sections
    items: List[OrderItem] = Field(default_factory=list)
    print_spec: Optional[PrintServiceSpec] = None
    porter_spec: Optional[PorterServiceSpec] = None
    assignment_spec: Optional[AssignmentServiceSpec] = None

    # Payment details
    payment_method: PaymentMethod = PaymentMethod.CASH
    payment_status: PaymentStatus = PaymentStatus.PENDING
    upi_transaction_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None


    # Delivery information
    delivery_address: Optional[str] = None
    delivery_location: Optional[GPSLocation] = None
    customer_phone: Optional[str] = None

    # Ringing partner list (partners within 1KM radius notified)
    notified_partner_ids: List[str] = Field(default_factory=list)

    # Financial details
    items_total: float = Field(0.0, ge=0.0)
    delivery_fee: float = Field(0.0, ge=0.0)
    total_amount: float = Field(0.0, ge=0.0)

    # Customer Rating & Review details
    is_rated: bool = Field(False, description="Whether customer has rated this order")
    rating: Optional[float] = Field(None, ge=1.0, le=5.0, description="Customer star rating (1.0 - 5.0)")
    review: Optional[str] = Field(None, description="Customer feedback review text")

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Settings:
        name = "orders"
        indexes = [
            "customer_id",
            "partner_id",
            "status",
            [("customer_id", 1), ("created_at", -1)],
            [("partner_id", 1), ("status", 1)],
            [("status", 1), ("created_at", -1)],
        ]

    def touch(self):
        self.updated_at = datetime.now(timezone.utc)

