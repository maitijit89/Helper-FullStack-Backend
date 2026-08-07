from datetime import datetime, timezone
from typing import List, Optional
import secrets
from beanie import PydanticObjectId
from app.core.exceptions import BadRequestException, NotFoundException
from app.models.order import Order, OrderItem, OrderStatus, OrderType, PorterServiceSpec, PrintServiceSpec
from app.models.product import Product
from app.schemas.order import PorterOrderCreate, PrintOrderCreate, QuickCommerceOrderCreate


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

        delivery_fee = 25.0  # Standard delivery charge
        total_amount = items_total + delivery_fee

        order = Order(
            order_id=self._generate_order_id(),
            customer_id=customer_id,
            order_type=OrderType.PRODUCT_ORDER,
            status=OrderStatus.PENDING,
            items=order_items,
            delivery_address=obj_in.delivery_address,
            delivery_location=obj_in.delivery_location,
            customer_phone=obj_in.customer_phone,
            items_total=items_total,
            delivery_fee=delivery_fee,
            total_amount=total_amount,
        )
        await order.insert()
        return order

    async def create_print_order(
        self, customer_id: str, obj_in: PrintOrderCreate
    ) -> Order:
        # Rate per B&W page: 2.0 INR, Color page: 10.0 INR
        page_rate = 10.0 if obj_in.color_mode.lower() == "color" else 2.0
        print_cost = page_rate * obj_in.num_pages * obj_in.num_copies

        # Binding costs: spiral = 30 INR, channel_file = 20 INR
        binding_cost = 0.0
        if obj_in.binding_type.lower() == "spiral":
            binding_cost = 30.0 * obj_in.num_copies
        elif obj_in.binding_type.lower() == "channel_file":
            binding_cost = 20.0 * obj_in.num_copies

        items_total = print_cost + binding_cost
        delivery_fee = 20.0
        total_amount = items_total + delivery_fee

        print_spec = PrintServiceSpec(
            file_url=obj_in.file_url,
            document_name=obj_in.document_name,
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
            delivery_address=obj_in.delivery_address,
            delivery_location=obj_in.delivery_location,
            customer_phone=obj_in.customer_phone,
            items_total=items_total,
            delivery_fee=delivery_fee,
            total_amount=total_amount,
        )
        await order.insert()
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
            delivery_address=obj_in.drop_address,
            delivery_location=obj_in.drop_location,
            customer_phone=obj_in.sender_phone,
            items_total=items_total,
            delivery_fee=delivery_fee,
            total_amount=total_amount,
        )
        await order.insert()
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
        """Delivery partner accepts order."""
        order = await self.get_by_id(order_id)
        if not order:
            raise NotFoundException("Order not found.")

        if order.status != OrderStatus.PENDING or order.partner_id is not None:
            raise BadRequestException("Order is no longer available for acceptance.")

        order.partner_id = partner_id
        order.status = OrderStatus.ACCEPTED
        order.touch()
        await order.save()
        return order

    async def update_order_status(self, order_id: str, status: OrderStatus) -> Order:
        order = await self.get_by_id(order_id)
        if not order:
            raise NotFoundException("Order not found.")

        order.status = status
        order.touch()
        await order.save()
        return order


order_crud = CRUDOrder()
