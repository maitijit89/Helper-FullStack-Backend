from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr


class OTPPurpose(str, Enum):
    VERIFICATION = "verification"
    LOGIN = "login"


class OTPRequest(BaseModel):
    email: EmailStr


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


class OTPResponse(BaseModel):
    email: str
    message: str
    email_sent: bool = True
    # In development / test environment, output OTP for testing convenience
    dev_otp: Optional[str] = None
