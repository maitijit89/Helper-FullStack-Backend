from datetime import datetime
from typing import Annotated, Optional
from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field
from app.models.support_ticket import SupportTicketStatus

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if v is not None else None)]


class SupportTicketCreate(BaseModel):
    """Schema for submitting a customer support report / ticket."""

    name: str
    email: EmailStr
    phone: str
    subject: str
    details: str


class SupportTicketSolve(BaseModel):
    """Schema for Admin to mark a report ticket as SOLVED."""

    admin_notes: Optional[str] = Field(None, description="Optional resolution note from Admin")


class SupportTicketResponse(BaseModel):
    """API response schema for customer support tickets."""

    id: PyObjectId = Field(validation_alias="_id")
    ticket_id: str
    user_id: Optional[str] = None
    name: str
    email: EmailStr
    phone: str
    subject: str
    details: str
    status: SupportTicketStatus
    admin_notes: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )
