from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class DeliveryMode(str, Enum):
    CYCLE = "cycle"
    WALKING = "walking"


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
    is_online: bool = False
    verification_status: PartnerVerificationStatus = PartnerVerificationStatus.PENDING
    rejection_reason: Optional[str] = None
    last_application_date: Optional[datetime] = None


class PartnerCreate(BaseModel):
    name: str
    dob: str
    email: EmailStr
    phone: str
    college: str
    current_address: str
    permanent_address: str
    delivery_mode: DeliveryMode


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


class PartnerVerificationUpdate(BaseModel):
    status: PartnerVerificationStatus
    rejection_reason: Optional[str] = None
