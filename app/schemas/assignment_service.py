from typing import Optional
from pydantic import BaseModel, Field
from app.models.order import PaymentMethod
from app.schemas.location import GPSLocation


class AssignmentCalculateRequest(BaseModel):
    """Schema for instant price calculation preview when user selects assignment page count & belongings."""

    num_pages: int = Field(..., ge=1, description="Number of pages to write by hand")
    paper_type: str = Field("a4_ruled", description="a4_ruled, a4_unruled, practical_sheet")
    binding_type: str = Field("none", description="none, channel_file, spiral")
    ink_color: str = Field("blue", description="blue, black, blue_black, multicolor")


class AssignmentOrderConfirmRequest(BaseModel):
    """Schema for user placing handwritten assignment writer order."""

    file_url: Optional[str] = Field(None, description="URL of reference uploaded document/images")
    document_name: str = Field("Assignment", description="Topic/Name of assignment")
    is_physical_pickup: bool = Field(False, description="True if partner physically picks up hardcopy notes/notebook from customer")
    num_pages: int = Field(..., ge=1, description="Number of pages to be handwritten")
    paper_type: str = Field("a4_ruled", description="a4_ruled, a4_unruled, practical_sheet")
    binding_type: str = Field("none", description="none, channel_file, spiral")
    ink_color: str = Field("blue", description="blue, black, blue_black, multicolor")

    delivery_address: str = Field(..., description="Delivery street address where assignment will be delivered")
    delivery_location: Optional[GPSLocation] = Field(None, description="GPS location for 1KM radius partner ringing")
    customer_phone: Optional[str] = Field(None, description="Customer contact phone number")
    payment_method: PaymentMethod = Field(..., description="upi or cash")
    upi_transaction_id: Optional[str] = Field(None, description="UPI reference/transaction ID if payment_method is upi")
    special_instructions: Optional[str] = Field(None, description="Handwriting instructions, heading style, etc.")


class AssignmentOrderCreate(BaseModel):
    """Schema used internally by CRUD layer to create Assignment Order."""

    file_url: Optional[str] = None
    document_name: str = "Assignment"
    is_physical_pickup: bool = False
    num_pages: int = Field(1, ge=1)
    paper_type: str = "a4_ruled"
    binding_type: str = "none"
    ink_color: str = "blue"
    delivery_address: str
    delivery_location: Optional[GPSLocation] = None
    customer_phone: str
    special_instructions: Optional[str] = None
    payment_method: PaymentMethod = PaymentMethod.CASH
    upi_transaction_id: Optional[str] = None
