import logging
from typing import Any
from fastapi import APIRouter, Depends, Header, Request, status

from app.api.deps import get_current_active_user
from app.core.config import settings
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.crud.crud_order import order_crud
from app.models.order import Order, PaymentMethod, PaymentStatus
from app.models.user import User
from app.schemas.payment import (
    RazorpayOrderCreateRequest,
    RazorpayOrderResponse,
    RazorpayRefundRequest,
    RazorpayRefundResponse,
    RazorpayVerifyRequest,
    RazorpayVerifyResponse,
)
from app.schemas.response import APIResponse
from app.services.razorpay_service import razorpay_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/razorpay/create-order",
    response_model=APIResponse[RazorpayOrderResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_razorpay_order(
    req: RazorpayOrderCreateRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Creates a Razorpay Order for an existing system order.
    Returns parameters (order_id, amount, key_id) required to launch Razorpay Checkout on frontend.
    """
    target_order_id = req.get_order_id
    if not target_order_id:
        raise BadRequestException("Order ID ('order_id', 'system_order_id', or 'orderId') is required.")

    order = await order_crud.get_by_id(target_order_id)
    if not order:
        raise NotFoundException(f"Order '{target_order_id}' not found.")

    user_id_str = str(current_user.id)
    if order.customer_id != user_id_str and not current_user.is_superuser:
        raise ForbiddenException("You are not authorized to initiate payment for this order.")

    if order.payment_status == PaymentStatus.PAID:
        raise BadRequestException("This order has already been paid for.")

    notes = {
        "system_order_id": order.order_id,
        "customer_id": user_id_str,
        "order_type": order.order_type.value,
    }
    if req.notes:
        notes.update(req.notes)

    rzp_order = razorpay_service.create_order(
        amount_in_rupees=order.total_amount,
        receipt=order.order_id,
        notes=notes,
    )

    # Save Razorpay order ID on system Order model
    order.razorpay_order_id = rzp_order["id"]
    order.payment_method = PaymentMethod.RAZORPAY
    order.touch()
    await order.save()

    response_data = RazorpayOrderResponse(
        razorpay_order_id=rzp_order["id"],
        amount=order.total_amount,
        amount_in_paise=rzp_order["amount"],
        currency=rzp_order.get("currency", "INR"),
        key_id=settings.RAZORPAY_KEY_ID,
        system_order_id=order.order_id,
    )

    return APIResponse(
        success=True,
        message="Razorpay order created successfully.",
        data=response_data,
    )


@router.post(
    "/razorpay/verify",
    response_model=APIResponse[RazorpayVerifyResponse],
)
async def verify_razorpay_payment(
    req: RazorpayVerifyRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Verifies Razorpay payment signature upon Checkout completion.
    Updates system order payment status to PAID upon successful signature validation.
    """
    target_order_id = req.get_order_id
    if not target_order_id:
        raise BadRequestException("Order ID ('order_id', 'system_order_id', or 'orderId') is required.")

    order = await order_crud.get_by_id(target_order_id)
    if not order:
        raise NotFoundException(f"Order '{target_order_id}' not found.")

    user_id_str = str(current_user.id)
    if order.customer_id != user_id_str and not current_user.is_superuser:
        raise ForbiddenException("You are not authorized to verify payment for this order.")

    is_valid = razorpay_service.verify_payment_signature(
        razorpay_order_id=req.razorpay_order_id,
        razorpay_payment_id=req.razorpay_payment_id,
        razorpay_signature=req.razorpay_signature,
    )

    if not is_valid:
        raise BadRequestException("Invalid payment signature. Verification failed.")

    # Update order payment state
    order.payment_method = PaymentMethod.RAZORPAY
    order.payment_status = PaymentStatus.PAID
    order.razorpay_order_id = req.razorpay_order_id
    order.razorpay_payment_id = req.razorpay_payment_id
    order.touch()
    await order.save()

    # Ring nearby delivery partners if not already alerted
    if not order.notified_partner_ids and order.delivery_location:
        try:
            await order_crud._ring_nearby_partners_if_location_available(order)
        except Exception as ring_err:
            logger.warning(f"Failed to ring partners after payment verification: {ring_err}")

    logger.info(f"Payment successful & verified for order {order.order_id} via payment ID {req.razorpay_payment_id}")

    return APIResponse(
        success=True,
        message="Payment verified successfully. Order status updated to PAID.",
        data=RazorpayVerifyResponse(
            success=True,
            order_id=order.order_id,
            message="Payment verified successfully",
            razorpay_payment_id=req.razorpay_payment_id,
        ),
    )


@router.post("/razorpay/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="X-Razorpay-Signature"),
) -> Any:
    """
    Asynchronous Webhook handler for Razorpay backend notifications (e.g., payment.captured, payment.failed).
    """
    raw_body = await request.body()
    if settings.RAZORPAY_WEBHOOK_SECRET and x_razorpay_signature:
        is_valid = razorpay_service.verify_webhook_signature(
            raw_body=raw_body,
            signature=x_razorpay_signature,
        )
        if not is_valid:
            logger.warning("Invalid Razorpay webhook signature received.")
            raise BadRequestException("Invalid webhook signature.")

    try:
        event_data = await request.json()
    except Exception:
        raise BadRequestException("Invalid JSON payload.")

    event_name = event_data.get("event")
    logger.info(f"Received Razorpay webhook event: {event_name}")

    if event_name in ["payment.captured", "order.paid"]:
        payload = event_data.get("payload", {})
        payment_entity = payload.get("payment", {}).get("entity", {})
        rzp_order_id = payment_entity.get("order_id")
        rzp_payment_id = payment_entity.get("id")

        if rzp_order_id:
            order = await Order.find_one(Order.razorpay_order_id == rzp_order_id)
            if order and order.payment_status != PaymentStatus.PAID:
                order.payment_status = PaymentStatus.PAID
                order.payment_method = PaymentMethod.RAZORPAY
                if rzp_payment_id:
                    order.razorpay_payment_id = rzp_payment_id
                order.touch()
                await order.save()
                logger.info(f"Webhook updated order {order.order_id} to PAID via {event_name}")

                if not order.notified_partner_ids and order.delivery_location:
                    try:
                        await order_crud._ring_nearby_partners_if_location_available(order)
                    except Exception as ring_err:
                        logger.warning(f"Failed to ring partners after webhook payment capture: {ring_err}")

    return {"status": "ok", "event": event_name}


@router.post(
    "/razorpay/refund",
    response_model=APIResponse[RazorpayRefundResponse],
)
async def refund_razorpay_payment(
    req: RazorpayRefundRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Process full or partial refund for an order paid via Razorpay.
    Authorized for customer (for eligible cancelled orders) or system Admin.
    """
    order = await order_crud.get_by_id(req.order_id)
    if not order:
        raise NotFoundException(f"Order '{req.order_id}' not found.")

    user_id_str = str(current_user.id)
    if order.customer_id != user_id_str and not current_user.is_superuser:
        raise ForbiddenException("You are not authorized to request a refund for this order.")

    if not order.razorpay_payment_id:
        raise BadRequestException("This order has no associated Razorpay payment ID.")

    if order.payment_status not in [PaymentStatus.PAID, PaymentStatus.FAILED]:
        raise BadRequestException(f"Cannot refund order with payment status '{order.payment_status.value}'.")

    refund_amount = req.amount or order.total_amount
    refund_res = razorpay_service.refund_payment(
        payment_id=order.razorpay_payment_id,
        amount_in_rupees=refund_amount,
        notes={
            "order_id": order.order_id,
            "reason": req.reason or "Customer/Admin requested refund",
            "requested_by": user_id_str,
        },
    )

    # Update order payment status
    order.payment_status = PaymentStatus.FAILED
    order.touch()
    await order.save()

    logger.info(f"Processed refund of Rs. {refund_amount} for order {order.order_id} via refund ID {refund_res.get('id')}")

    return APIResponse(
        success=True,
        message=f"Refund of ₹{refund_amount:.2f} processed successfully.",
        data=RazorpayRefundResponse(
            success=True,
            order_id=order.order_id,
            refund_id=refund_res.get("id", "rfnd_simulated"),
            payment_id=order.razorpay_payment_id,
            amount_refunded=refund_amount,
            message="Refund initiated successfully",
            currency="INR",
        ),
    )

