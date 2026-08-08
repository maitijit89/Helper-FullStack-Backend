from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class SupportTicketStatus(str, Enum):
    PENDING = "pending"
    SOLVED = "solved"


class SupportTicket(Document):
    """MongoDB Document model for Customer Support Reports & Tickets."""

    ticket_id: Indexed(str, unique=True)
    user_id: Optional[str] = None
    name: str
    email: str
    phone: str
    subject: str
    details: str
    status: SupportTicketStatus = SupportTicketStatus.PENDING
    admin_notes: Optional[str] = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    resolved_at: Optional[datetime] = None

    class Settings:
        name = "support_tickets"
        indexes = [
            "status",
            "email",
            "phone",
            "user_id",
            [("status", 1), ("created_at", -1)],
        ]

    def touch(self):
        """Update updated timestamp."""
        pass
