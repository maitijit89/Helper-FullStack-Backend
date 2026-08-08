from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class DeliveryMode(str, Enum):
    CYCLE = "cycle"
    WALKING = "walking"
    BIKE = "bike"
    SCOOTER = "scooter"
    AUTO = "auto"
    CAR = "car"
    MINI_TRUCK = "mini_truck"



class PartnerVerificationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PartnerProfile(BaseModel):
    partner_id: Optional[str] = None  # Assigned upon Admin Approval (e.g. PRT-892134)
    delivery_mode: DeliveryMode
    college: str
    current_address: str
    permanent_address: str
    dob: str
    phone: str
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_url: Optional[str] = None
    pan_url: Optional[str] = None
    selfie_url: Optional[str] = None
    is_online: bool = False
    verification_status: PartnerVerificationStatus = PartnerVerificationStatus.PENDING
    rejection_reason: Optional[str] = None
    last_application_date: Optional[datetime] = None
    application_fee_paid: bool = True
    application_fee_amount: float = 1.0
    payment_method: str = "upi"
    upi_transaction_id: Optional[str] = None
    payment_timestamp: Optional[datetime] = None


class PartnerCreate(BaseModel):
    name: str
    dob: str
    email: EmailStr
    phone: str
    college: str
    current_address: str
    permanent_address: str
    delivery_mode: DeliveryMode
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_url: Optional[str] = None
    pan_url: Optional[str] = None
    selfie_url: Optional[str] = None
    application_fee: float = Field(1.0, description="Mandatory RS 1 application fee")
    payment_method: str = "upi"
    upi_transaction_id: Optional[str] = None



class PartnerLoginRequest(BaseModel):
    partner_id_or_email: str
    password: str


class PartnerChangePassword(BaseModel):
    previous_password: str
    new_password: str


class PartnerUpdate(BaseModel):
    delivery_mode: Optional[DeliveryMode] = None
    phone: Optional[str] = None
    current_address: Optional[str] = None
    permanent_address: Optional[str] = None
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_url: Optional[str] = None
    pan_url: Optional[str] = None
    selfie_url: Optional[str] = None


class PartnerVerificationUpdate(BaseModel):
    status: PartnerVerificationStatus
    rejection_reason: Optional[str] = None


class AdminPartnerUpdate(BaseModel):
    """Schema for Admin panel to patch any partner application details."""

    full_name: Optional[str] = None
    phone: Optional[str] = None
    college: Optional[str] = None
    dob: Optional[str] = None
    delivery_mode: Optional[DeliveryMode] = None
    current_address: Optional[str] = None
    permanent_address: Optional[str] = None
    aadhaar_number: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_url: Optional[str] = None
    pan_url: Optional[str] = None
    selfie_url: Optional[str] = None
    verification_status: Optional[PartnerVerificationStatus] = None
    rejection_reason: Optional[str] = None

