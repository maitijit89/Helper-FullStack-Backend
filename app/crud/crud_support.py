import secrets
from datetime import datetime, timezone
from typing import List, Optional
from beanie import PydanticObjectId
from beanie.operators import Or

from app.models.support_ticket import SupportTicket, SupportTicketStatus
from app.schemas.support_ticket import SupportTicketCreate


class CRUDSupport:
    def _generate_ticket_id(self) -> str:
        """Generate a random unique Ticket ID like TKT-892134."""
        return f"TKT-{''.join(secrets.choice('0123456789') for _ in range(6))}"

    async def create_ticket(
        self, obj_in: SupportTicketCreate, user_id: Optional[str] = None
    ) -> SupportTicket:
        """Create and insert a new SupportTicket document into MongoDB."""
        ticket = SupportTicket(
            ticket_id=self._generate_ticket_id(),
            user_id=user_id,
            name=obj_in.name,
            email=obj_in.email,
            phone=obj_in.phone,
            subject=obj_in.subject,
            details=obj_in.details,
            status=SupportTicketStatus.PENDING,
            admin_notes=None,
            created_at=datetime.now(timezone.utc),
            resolved_at=None,
        )
        await ticket.insert()
        return ticket

    async def get_by_ticket_id(self, ticket_id: str) -> Optional[SupportTicket]:
        """Fetch ticket by unique Ticket ID string (e.g., TKT-892134)."""
        ticket = await SupportTicket.find_one(SupportTicket.ticket_id == ticket_id)
        if not ticket:
            try:
                ticket = await SupportTicket.get(PydanticObjectId(ticket_id))
            except Exception:
                ticket = None
        return ticket

    async def get_multi(
        self, status: Optional[SupportTicketStatus] = None, skip: int = 0, limit: int = 100
    ) -> List[SupportTicket]:
        """Fetch multiple support tickets filtered by status."""
        query = SupportTicket.find_all()
        if status:
            query = query.find(SupportTicket.status == status)
        return await query.sort("-created_at").skip(skip).limit(limit).to_list()

    async def get_user_tickets(
        self, user_id: Optional[str] = None, email: Optional[str] = None, skip: int = 0, limit: int = 100
    ) -> List[SupportTicket]:
        """Fetch support tickets belonging to a specific customer user or email."""
        conditions = []
        if user_id:
            conditions.append(SupportTicket.user_id == user_id)
        if email:
            conditions.append(SupportTicket.email == email)

        if not conditions:
            return []

        if len(conditions) == 1:
            query = SupportTicket.find(conditions[0])
        else:
            query = SupportTicket.find(Or(*conditions))

        return await query.sort("-created_at").skip(skip).limit(limit).to_list()

    async def solve_ticket(
        self, db_obj: SupportTicket, admin_notes: Optional[str] = None
    ) -> SupportTicket:
        """Mark a support ticket as SOLVED with resolution notes and timestamp."""
        db_obj.status = SupportTicketStatus.SOLVED
        db_obj.admin_notes = admin_notes or "Resolved by Admin"
        db_obj.resolved_at = datetime.now(timezone.utc)
        await db_obj.save()
        return db_obj


support_crud = CRUDSupport()
