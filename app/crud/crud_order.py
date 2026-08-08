from datetime import datetime, timezone
from typing import List, Optional
import secrets
from beanie import PydanticObjectId
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.order import (
    AssignmentServiceSpec,
    Order,
    OrderItem,
    OrderStatus,
    OrderType,
    PaymentMethod,
    PaymentStatus,
    PorterServiceSpec,
    PrintServiceSpec,
)
from app.models.product import Product
from app.schemas.assignment_service import AssignmentOrderCreate
from app.schemas.order import PorterOrderCreate, PrintOrderCreate, QuickCommerceOrderCreate
from app.services.assignment_service import assignment_writer_engine
from app.services.geo_service import geo_service
from app.services.print_pricing_engine import print_pricing_engine
from app.services.websocket_manager import socket_manager

MIN_ORDER_PRICE = 10.0


class CRUDOrder:
    def _generate_order_id(self) -> str:
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        rand_str = ''.join(secrets.choice("0123456789") for _ in range(6))
        return f"ORD-{date_str}-{rand_str}"

    async def get_by_id(self, order_id_or_id: str) -> Optional[Order]:
        """Fetch order by internal ObjectId or public order_id string (ORD-...)."""
        order = await Order.find_one(Order.order_id == order_id_or_id)
        if not order:
            try:
                order = await Order.get(PydanticObjectId(order_id_or_id))
            except Exception:
                order = None
        return order

    async def _ring_nearby_partners_if_location_available(self, order: Order):
        """Helper to find and ring delivery partners within 1KM radius."""
        if not order.delivery_location:
            return

        nearby = await geo_service.find_partners_within_radius(
            customer_lat=order.delivery_location.latitude,
            customer_lon=order.delivery_location.longitude,
            max_radius_km=1.0,
        )

        order_dict = {
            "order_id": order.order_id,
            "order_type": order.order_type.value,
            "items_total": order.items_total,
            "total_amount": order.total_amount,
            "delivery_address": order.delivery_address,
            "payment_method": order.payment_method.value,
            "payment_status": order.payment_status.value,
        }

        notified_ids = await socket_manager.ring_partners_within_1km(
            order_id=order.order_id,
            partner_distances=nearby,
            order_payload=order_dict,
        )

        order.notified_partner_ids = notified_ids
        await order.save()

    async def create_quick_commerce_order(
        self, customer_id: str, obj_in: QuickCommerceOrderCreate
    ) -> Order:
        order_items: List[OrderItem] = []
        items_total = 0.0

        for item_req in obj_in.items:
            try:
                product = await Product.get(PydanticObjectId(item_req.product_id))
            except Exception:
                product = None
            if not product or not product.is_available:
                raise BadRequestException(f"Product ID '{item_req.product_id}' is not available.")

            subtotal = product.price * item_req.quantity
            items_total += subtotal
            order_items.append(
                OrderItem(
                    product_id=str(product.id),
                    product_name=product.name,
                    quantity=item_req.quantity,
                    unit_price=product.price,
                    subtotal=subtotal,
                )
            )

        # Enforce minimum order price of RS. 10
        if items_total < MIN_ORDER_PRICE:
            raise BadRequestException(
                f"Minimum order price must be RS. {MIN_ORDER_PRICE:.2f}. "
                f"Your items total is RS. {items_total:.2f}. Direct ordering below RS. 10 is not allowed."
            )

        delivery_fee = 25.0  # Standard delivery charge
        total_amount = items_total + delivery_fee

        payment_method = obj_in.payment_method
        payment_status = (
            PaymentStatus.PAID
            if payment_method == PaymentMethod.UPI and obj_in.upi_transaction_id
            else (PaymentStatus.CASH_ON_DELIVERY if payment_method == PaymentMethod.CASH else PaymentStatus.PENDING)
        )

        order = Order(
            order_id=self._generate_order_id(),
            customer_id=customer_id,
            order_type=OrderType.PRODUCT_ORDER,
            status=OrderStatus.PENDING,
            items=order_items,
            payment_method=payment_method,
            payment_status=payment_status,
            upi_transaction_id=obj_in.upi_transaction_id,
            delivery_address=obj_in.delivery_address,
            delivery_location=obj_in.delivery_location,
            customer_phone=obj_in.customer_phone,
            items_total=items_total,
            delivery_fee=delivery_fee,
            total_amount=total_amount,
        )
        await order.insert()

        # Ring partners within 1KM radius
        await self._ring_nearby_partners_if_location_available(order)
        return order

    async def create_print_order(
        self, customer_id: str, obj_in: PrintOrderCreate
    ) -> Order:
        # Calculate dynamic quote via PrintPricingEngine
        quote = print_pricing_engine.compute_print_quote(
            num_pages=obj_in.num_pages,
            num_copies=obj_in.num_copies,
            color_mode=obj_in.color_mode,
            paper_size=obj_in.paper_size,
            is_double_sided=obj_in.is_double_sided,
            binding_type=obj_in.binding_type,
        )

        items_total = quote["items_subtotal"]

        # Enforce minimum order price of RS. 10
        if items_total < MIN_ORDER_PRICE:
            raise BadRequestException(
                f"Minimum order price must be RS. {MIN_ORDER_PRICE:.2f}. Your print total is RS. {items_total:.2f}."
            )

        delivery_fee = quote["delivery_fee"]
        total_amount = quote["total_amount"]

        payment_method = obj_in.payment_method
        payment_status = (
            PaymentStatus.PAID
            if payment_method == PaymentMethod.UPI and obj_in.upi_transaction_id
            else (PaymentStatus.CASH_ON_DELIVERY if payment_method == PaymentMethod.CASH else PaymentStatus.PENDING)
        )

        print_spec = PrintServiceSpec(
            file_url=obj_in.file_url,
            document_name=obj_in.document_name,
            is_physical_pickup=obj_in.is_physical_pickup,
            num_pages=obj_in.num_pages,
            num_copies=obj_in.num_copies,
            color_mode=obj_in.color_mode,
            paper_size=obj_in.paper_size,
            is_double_sided=obj_in.is_double_sided,
            binding_type=obj_in.binding_type,
            special_instructions=obj_in.special_instructions,
        )


        order = Order(
            order_id=self._generate_order_id(),
            customer_id=customer_id,
            order_type=OrderType.PRINT_SERVICE,
            status=OrderStatus.PENDING,
            print_spec=print_spec,
            payment_method=payment_method,
            payment_status=payment_status,
            upi_transaction_id=obj_in.upi_transaction_id,
            delivery_address=obj_in.delivery_address,
            delivery_location=obj_in.delivery_location,
            customer_phone=obj_in.customer_phone,
            items_total=items_total,
            delivery_fee=delivery_fee,
            total_amount=total_amount,
        )
        await order.insert()

        await self._ring_nearby_partners_if_location_available(order)
        return order

    async def create_assignment_order(
        self, customer_id: str, obj_in: AssignmentOrderCreate
    ) -> Order:
        cost_breakdown = assignment_writer_engine.calculate_assignment_cost(
            num_pages=obj_in.num_pages,
            paper_type=obj_in.paper_type,
            binding_type=obj_in.binding_type,
            ink_color=obj_in.ink_color,
        )

        items_total = cost_breakdown["items_total"]
        if items_total < MIN_ORDER_PRICE:
            raise BadRequestException(
                f"Minimum order price must be RS. {MIN_ORDER_PRICE:.2f}. Your assignment total is RS. {items_total:.2f}."
            )

        delivery_fee = cost_breakdown["delivery_fee"]
        total_amount = cost_breakdown["total_amount"]

        payment_method = obj_in.payment_method
        payment_status = (
            PaymentStatus.PAID
            if payment_method == PaymentMethod.UPI and obj_in.upi_transaction_id
            else (PaymentStatus.CASH_ON_DELIVERY if payment_method == PaymentMethod.CASH else PaymentStatus.PENDING)
        )

        assignment_spec = AssignmentServiceSpec(
            file_url=obj_in.file_url,
            document_name=obj_in.document_name,
            is_physical_pickup=obj_in.is_physical_pickup,
            num_pages=obj_in.num_pages,
            paper_type=obj_in.paper_type,
            binding_type=obj_in.binding_type,
            ink_color=obj_in.ink_color,
            special_instructions=obj_in.special_instructions,
        )

        order = Order(
            order_id=self._generate_order_id(),
            customer_id=customer_id,
            order_type=OrderType.ASSIGNMENT_WRITER,
            status=OrderStatus.PENDING,
            assignment_spec=assignment_spec,
            payment_method=payment_method,
            payment_status=payment_status,
            upi_transaction_id=obj_in.upi_transaction_id,
            delivery_address=obj_in.delivery_address,
            delivery_location=obj_in.delivery_location,
            customer_phone=obj_in.customer_phone,
            items_total=items_total,
            delivery_fee=delivery_fee,
            total_amount=total_amount,
        )
        await order.insert()

        await self._ring_nearby_partners_if_location_available(order)
        return order

    async def create_porter_order(
        self, customer_id: str, obj_in: PorterOrderCreate
    ) -> Order:
        if obj_in.weight_kg > 5.0:
            raise BadRequestException("Porter courier service is strictly for items under 5.0 kg.")

        # Pricing formula: Base 40 INR for up to 5kg parcel delivery
        delivery_fee = 40.0 + (obj_in.weight_kg * 5.0)
        items_total = 0.0
        total_amount = delivery_fee

        if total_amount < MIN_ORDER_PRICE:
            raise BadRequestException(f"Minimum order price must be RS. {MIN_ORDER_PRICE:.2f}.")

        payment_method = obj_in.payment_method
        payment_status = (
            PaymentStatus.PAID
            if payment_method == PaymentMethod.UPI and obj_in.upi_transaction_id
            else (PaymentStatus.CASH_ON_DELIVERY if payment_method == PaymentMethod.CASH else PaymentStatus.PENDING)
        )

        porter_spec = PorterServiceSpec(
            item_description=obj_in.item_description,
            weight_kg=obj_in.weight_kg,
            pickup_address=obj_in.pickup_address,
            pickup_location=obj_in.pickup_location,
            drop_address=obj_in.drop_address,
            drop_location=obj_in.drop_location,
            sender_phone=obj_in.sender_phone,
            receiver_phone=obj_in.receiver_phone,
            notes=obj_in.notes,
        )

        order = Order(
            order_id=self._generate_order_id(),
            customer_id=customer_id,
            order_type=OrderType.PORTER_SERVICE,
            status=OrderStatus.PENDING,
            porter_spec=porter_spec,
            payment_method=payment_method,
            payment_status=payment_status,
            upi_transaction_id=obj_in.upi_transaction_id,
            delivery_address=obj_in.drop_address,
            delivery_location=obj_in.drop_location,
            customer_phone=obj_in.sender_phone,
            items_total=items_total,
            delivery_fee=delivery_fee,
            total_amount=total_amount,
        )
        await order.insert()

        await self._ring_nearby_partners_if_location_available(order)
        return order

    async def get_user_orders(
        self, customer_id: str, skip: int = 0, limit: int = 100
    ) -> List[Order]:
        return (
            await Order.find(Order.customer_id == customer_id)
            .sort("-created_at")
            .skip(skip)
            .limit(limit)
            .to_list()
        )

    async def get_available_partner_orders(
        self, skip: int = 0, limit: int = 100
    ) -> List[Order]:
        """Fetch pending orders waiting for a delivery partner."""
        return (
            await Order.find(
                Order.status == OrderStatus.PENDING, Order.partner_id == None
            )
            .sort("-created_at")
            .skip(skip)
            .limit(limit)
            .to_list()
        )

    async def accept_order_partner(self, order_id: str, partner_id: str) -> Order:
        """
        1st partner accept algorithm:
        Atomically assigns the order to the partner who accepts 1st.
        Rejects subsequent attempts with HTTP 400 Bad Request error.
        """
        order = await self.get_by_id(order_id)
        if not order:
            raise NotFoundException("Order not found.")

        # Check if already accepted or non-pending
        if order.status != OrderStatus.PENDING or order.partner_id is not None:
            raise BadRequestException("Order has already been accepted by another delivery partner.")

        # Atomic lock: update status & partner_id if status is still pending and partner_id is None
        updated = await Order.find_one(
            Order.order_id == order.order_id,
            Order.status == OrderStatus.PENDING,
            Order.partner_id == None,
        )

        if not updated:
            raise BadRequestException("Order has already been accepted by another delivery partner.")

        updated.partner_id = partner_id
        updated.status = OrderStatus.ACCEPTED
        updated.touch()
        await updated.save()

        # Notify socket manager that order has been accepted
        await socket_manager.notify_order_accepted(
            order_id=updated.order_id,
            accepted_partner_id=partner_id,
            notified_partner_ids=updated.notified_partner_ids,
        )

        return updated

    async def update_order_status(self, order_id: str, status: OrderStatus) -> Order:
        order = await self.get_by_id(order_id)
        if not order:
            raise NotFoundException("Order not found.")

        order.status = status
        order.touch()
        await order.save()

        # If order is completed/delivered and assigned to a partner, credit delivery earnings to partner wallet
        if status == OrderStatus.DELIVERED and order.partner_id:
            from app.services.wallet_service import wallet_service
            await wallet_service.credit_partner_earnings(
                partner_id=order.partner_id,
                order_id=order.order_id,
                delivery_fee=order.delivery_fee,
            )

        return order



order_crud = CRUDOrder()

