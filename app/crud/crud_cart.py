from typing import Optional
from beanie import PydanticObjectId
from app.core.exceptions import BadRequestException, NotFoundException
from app.crud.crud_order import MIN_ORDER_PRICE, order_crud
from app.models.cart import Cart, CartItem
from app.models.order import Order, OrderItem, OrderStatus, OrderType, PaymentMethod, PaymentStatus
from app.models.product import Product
from app.schemas.cart import CartCheckoutRequest, CartItemAdd


class CRUDCart:
    async def get_or_create_cart(self, customer_id: str) -> Cart:
        cart = await Cart.find_one(Cart.customer_id == customer_id)
        if not cart:
            cart = Cart(customer_id=customer_id, items=[])
            await cart.insert()
        return cart

    async def add_item_to_cart(self, customer_id: str, obj_in: CartItemAdd) -> Cart:
        cart = await self.get_or_create_cart(customer_id)

        # Validate product
        try:
            product = await Product.get(PydanticObjectId(obj_in.product_id))
        except Exception:
            product = None

        if not product or not product.is_available:
            raise BadRequestException(f"Product with ID '{obj_in.product_id}' is not available.")

        # Check if item already exists in cart
        existing_item = next((item for item in cart.items if item.product_id == str(product.id)), None)

        if existing_item:
            existing_item.quantity += obj_in.quantity
            existing_item.subtotal = existing_item.quantity * existing_item.unit_price
        else:
            subtotal = product.price * obj_in.quantity
            cart.items.append(
                CartItem(
                    product_id=str(product.id),
                    product_name=product.name,
                    unit_price=product.price,
                    quantity=obj_in.quantity,
                    subtotal=subtotal,
                )
            )

        cart.recalculate_total()
        await cart.save()
        return cart

    async def update_item_quantity(self, customer_id: str, product_id: str, quantity: int) -> Cart:
        cart = await self.get_or_create_cart(customer_id)
        existing_item = next((item for item in cart.items if item.product_id == product_id), None)

        if not existing_item:
            raise NotFoundException(f"Product '{product_id}' is not in your bucket/cart.")

        if quantity <= 0:
            cart.items = [item for item in cart.items if item.product_id != product_id]
        else:
            existing_item.quantity = quantity
            existing_item.subtotal = quantity * existing_item.unit_price

        cart.recalculate_total()
        await cart.save()
        return cart

    async def remove_item_from_cart(self, customer_id: str, product_id: str) -> Cart:
        cart = await self.get_or_create_cart(customer_id)
        cart.items = [item for item in cart.items if item.product_id != product_id]
        cart.recalculate_total()
        await cart.save()
        return cart

    async def clear_cart(self, customer_id: str) -> Cart:
        cart = await self.get_or_create_cart(customer_id)
        cart.items = []
        cart.items_total = 0.0
        cart.touch()
        await cart.save()
        return cart

    async def checkout_cart(self, customer_id: str, obj_in: CartCheckoutRequest) -> Order:
        cart = await self.get_or_create_cart(customer_id)

        if not cart.items:
            raise BadRequestException("Your bucket/cart is empty. Please add items to your bucket before ordering.")

        # Minimum order price RS. 10 validation
        if cart.items_total < MIN_ORDER_PRICE:
            raise BadRequestException(
                f"Minimum order price must be RS. {MIN_ORDER_PRICE:.2f}. "
                f"Your current bucket items total is RS. {cart.items_total:.2f}. "
                "Please add more items to your bucket to reach the minimum order price of RS. 10."
            )

        order_items = [
            OrderItem(
                product_id=item.product_id,
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.subtotal,
            )
            for item in cart.items
        ]

        delivery_fee = 25.0
        total_amount = cart.items_total + delivery_fee

        payment_method = obj_in.payment_method
        payment_status = (
            PaymentStatus.PAID
            if payment_method == PaymentMethod.UPI and obj_in.upi_transaction_id
            else (PaymentStatus.CASH_ON_DELIVERY if payment_method == PaymentMethod.CASH else PaymentStatus.PENDING)
        )

        order = Order(
            order_id=order_crud._generate_order_id(),
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
            items_total=cart.items_total,
            delivery_fee=delivery_fee,
            total_amount=total_amount,
        )
        await order.insert()

        # Trigger 1KM radius partner ringing
        await order_crud._ring_nearby_partners_if_location_available(order)

        # Clear cart upon successful order creation
        await self.clear_cart(customer_id)

        return order


cart_crud = CRUDCart()
