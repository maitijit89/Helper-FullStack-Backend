from datetime import datetime
from typing import Annotated, Optional
from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field
from app.schemas.gender import Gender
from app.schemas.location import GPSLocation
from app.schemas.partner import PartnerProfile
from app.schemas.role import UserRole

# Converts Mongo ObjectId / PydanticObjectId to string cleanly
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if v is not None else None)]


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = Field(None, alias="name")
    dob: Optional[str] = None
    gender: Optional[Gender] = None
    phone: Optional[str] = None
    college: Optional[str] = None
    address: Optional[str] = None
    role: UserRole = UserRole.USER
    location: Optional[GPSLocation] = None
    is_gps_enabled: bool = False
    is_email_verified: bool = False
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False

    model_config = ConfigDict(populate_by_name=True)


class CustomerUserCreate(BaseModel):
    """Customer registration schema requiring Name, DOB, Gender, Email, Phone, College, and Address."""

    name: str
    dob: str  # e.g., '2000-01-15'
    gender: Gender
    email: EmailStr
    phone: str
    college: str
    address: str
    password: Optional[str] = None  # Optional since passwordless OTP is supported


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    role: Optional[UserRole] = UserRole.USER


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[Gender] = None
    phone: Optional[str] = None
    college: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: PyObjectId = Field(validation_alias="_id")
    partner_profile: Optional[PartnerProfile] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )
