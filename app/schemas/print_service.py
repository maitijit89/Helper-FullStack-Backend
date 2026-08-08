from typing import Optional
from pydantic import BaseModel, Field
from app.models.order import PaymentMethod
from app.schemas.location import GPSLocation


class DocumentUploadResponse(BaseModel):
    file_url: str = Field(..., description="URL path to uploaded document")
    document_name: str = Field(..., description="Original filename")
    detected_page_count: int = Field(..., description="Auto-detected page count by Page Counter Engine")
    detection_method: str = Field(..., description="Engine method used for detection (e.g. pdf, image, text)")
    file_size_bytes: int = Field(..., description="File size in bytes")
    cost_breakdown: dict = Field(..., description="Estimated printing cost breakdown")


class RecountRequest(BaseModel):
    file_url: str = Field(..., description="Uploaded document file URL")
    document_name: str = Field("Document", description="Document filename")
    total_detected_pages: int = Field(..., ge=1, description="Total detected pages in uploaded document")
    page_range: Optional[str] = Field(None, description="Custom page range filter, e.g. '1-5, 8-10' or 'all'")
    manual_page_override: Optional[int] = Field(None, ge=1, description="Manual page count override if user recounted manually")
    num_copies: int = Field(1, ge=1)
    color_mode: str = Field("black_and_white", description="black_and_white or color")
    paper_size: str = Field("A4", description="A4 or A3")
    is_double_sided: bool = False
    binding_type: str = Field("none", description="none, spiral, channel_file")


class RecountResponse(BaseModel):
    file_url: str
    document_name: str
    recount_type: str = Field(..., description="Type of recount: 'range_filter', 'manual_override', or 'all_pages'")
    final_page_count: int = Field(..., description="Final verified page count to print")
    cost_breakdown: dict = Field(..., description="Updated cost breakdown based on recount")
    message: str


class PrintOrderConfirmRequest(BaseModel):
    """Schema for user confirming page count ('OK') and placing print/Xerox order."""

    file_url: Optional[str] = Field(None, description="Uploaded document file URL (optional for physical pickup)")
    document_name: str = Field("Document", description="Document name")
    is_physical_pickup: bool = Field(False, description="True if partner physically picks up hardcopy document from customer for Xerox")
    confirmed_num_pages: int = Field(..., ge=1, description="User-verified/confirmed page count")
    num_copies: int = Field(1, ge=1)

    color_mode: str = Field("black_and_white", description="black_and_white or color")
    paper_size: str = Field("A4", description="A4 or A3")
    is_double_sided: bool = False
    binding_type: str = Field("none", description="none, spiral, channel_file")
    delivery_address: str = Field(..., description="Delivery street address")
    delivery_location: Optional[GPSLocation] = Field(None, description="GPS location for 1KM radius partner ringing")
    customer_phone: Optional[str] = Field(None, description="Customer contact phone number")
    payment_method: PaymentMethod = Field(..., description="upi or cash")
    upi_transaction_id: Optional[str] = Field(None, description="UPI reference/transaction ID if payment_method is upi")
    special_instructions: Optional[str] = None



class PrintOptionsCalculateRequest(BaseModel):
    """Schema for instant price preview when changing print options (Color/B&W, copies, paper size, binding)."""

    num_pages: int = Field(..., ge=1, description="Page count")
    num_copies: int = Field(1, ge=1, description="Number of copies")
    color_mode: str = Field("black_and_white", description="black_and_white (RS 2/pg) or color (RS 10/pg)")
    paper_size: str = Field("A4", description="A4 or A3")
    is_double_sided: bool = Field(False, description="True for 15% double-sided print discount")
    binding_type: str = Field("none", description="none, spiral (RS 30/copy), channel_file (RS 20/copy)")

