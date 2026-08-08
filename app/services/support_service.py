import logging
from typing import Optional
from app.core.config import settings
from app.core.exceptions import NotFoundException
from app.crud.crud_support import support_crud
from app.models.support_ticket import SupportTicket, SupportTicketStatus
from app.models.user import User
from app.schemas.support_ticket import SupportTicketCreate
from app.services.email_service import email_service

logger = logging.getLogger(__name__)


from app.services.analytics_service import FeatureCategory, analytics_service


class SupportService:
    async def submit_ticket(
        self, ticket_in: SupportTicketCreate, user: Optional[User] = None
    ) -> SupportTicket:
        """Submit customer support ticket, save to DB, and notify helpingservicesteam@gmail.com via email."""
        user_id = str(user.id) if user else None
        ticket = await support_crud.create_ticket(obj_in=ticket_in, user_id=user_id)

        # Track feature usage for Admin Analytics
        try:
            analytics_service.record_feature_usage(
                FeatureCategory.SUPPORT_TICKET, user_id
            )
        except Exception:
            pass


        # Notify Admin via Email
        try:
            subject = f"[SUPPORT REPORT] Ticket #{ticket.ticket_id}: {ticket.subject}"
            text_content = (
                f"New Support Ticket Received!\n\n"
                f"Ticket ID: {ticket.ticket_id}\n"
                f"Customer Name: {ticket.name}\n"
                f"Email: {ticket.email}\n"
                f"Phone: {ticket.phone}\n"
                f"Subject: {ticket.subject}\n\n"
                f"Details:\n{ticket.details}\n\n"
                f"Submitted At: {ticket.created_at.isoformat()}\n"
            )
            html_content = f"""
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #d97706;">New Customer Support Report</h2>
                <p><strong>Ticket ID:</strong> {ticket.ticket_id}</p>
                <p><strong>Customer Name:</strong> {ticket.name}</p>
                <p><strong>Email:</strong> {ticket.email}</p>
                <p><strong>Phone:</strong> {ticket.phone}</p>
                <p><strong>Subject:</strong> {ticket.subject}</p>
                <hr>
                <p><strong>Report Details:</strong></p>
                <blockquote style="background: #f3f4f6; padding: 15px; border-left: 4px solid #d97706; margin: 0;">
                    {ticket.details}
                </blockquote>
                <p style="margin-top: 20px; font-size: 12px; color: #666;">
                    Login to Admin Panel to resolve this ticket.
                </p>
            </div>
            """
            await email_service.send_email(
                to_email=settings.ADMIN_EMAIL,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
            )
        except Exception as err:
            logger.error("Failed sending ticket notification email to admin: %s", err)

        return ticket

    async def solve_ticket(
        self, ticket_id: str, admin_notes: Optional[str] = None
    ) -> SupportTicket:
        """Mark a support ticket as SOLVED by admin and notify customer via email."""
        ticket = await support_crud.get_by_ticket_id(ticket_id=ticket_id)
        if not ticket:
            raise NotFoundException("Support ticket not found.")

        updated_ticket = await support_crud.solve_ticket(
            db_obj=ticket, admin_notes=admin_notes
        )

        # Notify Customer via Email
        try:
            subject = f"[SOLVED] Your Support Ticket #{ticket.ticket_id} has been resolved"
            text_content = (
                f"Hello {ticket.name},\n\n"
                f"Great news! Your support report ticket #{ticket.ticket_id} has been marked as SOLVED by our team.\n\n"
                f"Issue: {ticket.subject}\n"
                f"Status: SOLVED\n"
                f"Resolution Notes: {updated_ticket.admin_notes}\n\n"
                f"Thank you for contacting Helping Services Support!\n"
            )
            html_content = f"""
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #16a34a;">Your Support Ticket is Solved!</h2>
                <p>Hello <strong>{ticket.name}</strong>,</p>
                <p>Your support report ticket <strong>#{ticket.ticket_id}</strong> has been successfully reviewed and marked as <strong>SOLVED</strong>.</p>
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 5px 0;"><strong>Ticket Subject:</strong> {ticket.subject}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #16a34a; font-weight: bold;">SOLVED</span></p>
                    <p style="margin: 5px 0;"><strong>Resolution Notes:</strong> {updated_ticket.admin_notes}</p>
                </div>
                <p>If you have any further questions, feel free to reply or submit a new report.</p>
                <p style="color: #666; font-size: 13px;">Best regards,<br>Helping Services Team</p>
            </div>
            """
            await email_service.send_email(
                to_email=ticket.email,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
            )
        except Exception as err:
            logger.error("Failed sending resolution notification email to customer: %s", err)

        return updated_ticket


support_service = SupportService()
