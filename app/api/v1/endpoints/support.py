from typing import Any, List, Optional
from fastapi import APIRouter, Depends, status
from app.api.deps import (
    get_current_active_user,
    get_current_admin,
    get_optional_current_user,
)
from app.crud.crud_support import support_crud
from app.models.support_ticket import SupportTicketStatus
from app.models.user import User
from app.schemas.response import APIResponse
from app.schemas.support_ticket import (
    SupportTicketCreate,
    SupportTicketResponse,
    SupportTicketSolve,
)
from app.services.support_service import support_service

router = APIRouter()


# ----------------------------------------------------
# Customer Support Endpoints
# ----------------------------------------------------

@router.post(
    "/tickets",
    response_model=APIResponse[SupportTicketResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_support_ticket(
    ticket_in: SupportTicketCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> Any:
    """
    Submit a customer support report or ticket with Name, Email, Phone, Subject, and Details.
    Sends notification email to helpingservicesteam@gmail.com and initializes status as 'pending'.
    """
    ticket = await support_service.submit_ticket(
        ticket_in=ticket_in, user=current_user
    )
    return APIResponse(
        success=True,
        message="Support report submitted successfully. Our team will review your report shortly.",
        data=SupportTicketResponse.model_validate(ticket),
    )


@router.get(
    "/tickets/me",
    response_model=APIResponse[List[SupportTicketResponse]],
)
async def get_my_support_tickets(
    email: Optional[str] = None,
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> Any:

    """
    Fetch all support reports submitted by current customer or matching email address.
    Each report shows current status ('pending' or 'solved').
    """
    user_id = str(current_user.id) if current_user else None
    target_email = email or (current_user.email if current_user else None)

    tickets = await support_crud.get_user_tickets(user_id=user_id, email=target_email)
    return APIResponse(
        success=True,
        message="Customer support tickets fetched successfully.",
        data=[SupportTicketResponse.model_validate(t) for t in tickets],
    )


@router.get(
    "/tickets/{ticket_id}",
    response_model=APIResponse[SupportTicketResponse],
)
async def get_ticket_status(
    ticket_id: str,
) -> Any:
    """Fetch status and details of a specific support ticket by Ticket ID (e.g. TKT-892134)."""
    ticket = await support_crud.get_by_ticket_id(ticket_id=ticket_id)
    if not ticket:
        return APIResponse(
            success=False,
            message="Support ticket not found.",
            data=None,
        )

    return APIResponse(
        success=True,
        message="Support ticket details fetched successfully.",
        data=SupportTicketResponse.model_validate(ticket),
    )


# ----------------------------------------------------
# Admin Panel Support Management Endpoints
# ----------------------------------------------------

@router.get(
    "/admin/tickets",
    response_model=APIResponse[List[SupportTicketResponse]],
)
async def list_support_tickets_for_admin(
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(get_current_admin),
) -> Any:
    """
    List customer support reports on Admin Panel (Admin required).
    Filtered by status: 'pending', 'solved', or 'all'.
    """
    status_enum = None
    if status_filter and status_filter.lower() != "all":
        try:
            status_enum = SupportTicketStatus(status_filter.lower())
        except ValueError:
            pass

    tickets = await support_crud.get_multi(
        status=status_enum, skip=skip, limit=limit
    )
    return APIResponse(
        success=True,
        message="Support tickets retrieved for Admin panel.",
        data=[SupportTicketResponse.model_validate(t) for t in tickets],
    )


@router.patch(
    "/admin/tickets/{ticket_id}/solve",
    response_model=APIResponse[SupportTicketResponse],
)
async def solve_support_ticket(
    ticket_id: str,
    req: Optional[SupportTicketSolve] = None,
    admin: User = Depends(get_current_admin),
) -> Any:
    """
    Mark a customer report as SOLVED by Admin (Admin required).
    Updates status to 'solved', logs admin notes, and triggers resolution email notification to customer.
    """
    notes = req.admin_notes if req else "Resolved by Administrator"
    updated_ticket = await support_service.solve_ticket(
        ticket_id=ticket_id, admin_notes=notes
    )
    return APIResponse(
        success=True,
        message="Support ticket marked as SOLVED successfully. Customer notified.",
        data=SupportTicketResponse.model_validate(updated_ticket),
    )
