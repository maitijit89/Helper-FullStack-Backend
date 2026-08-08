from typing import Any
from fastapi import APIRouter, Depends, status
from app.api.deps import get_current_active_user
from app.crud.crud_cart import cart_crud
from app.models.user import User
from app.schemas.cart import CartCheckoutRequest, CartItemAdd, CartItemUpdate, CartResponse
from app.schemas.order import OrderResponse
from app.schemas.response import APIResponse

router = APIRouter()


@router.get("", response_model=APIResponse[CartResponse])
async def get_my_cart(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """View current user's bucket/cart items and total amount."""
    cart = await cart_crud.get_or_create_cart(str(current_user.id))
    resp = CartResponse.model_validate(cart)
    resp.is_eligible_for_checkout = cart.items_total >= 10.0 and len(cart.items) > 0
    return APIResponse(
        success=True,
        message="Bucket/cart fetched successfully",
        data=resp,
    )


@router.post("/items", response_model=APIResponse[CartResponse], status_code=status.HTTP_200_OK)
async def add_item_to_cart(
    req: CartItemAdd,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Add a product item to user's bucket/cart."""
    cart = await cart_crud.add_item_to_cart(str(current_user.id), obj_in=req)
    resp = CartResponse.model_validate(cart)
    resp.is_eligible_for_checkout = cart.items_total >= 10.0 and len(cart.items) > 0
    return APIResponse(
        success=True,
        message="Item added to bucket successfully",
        data=resp,
    )


@router.put("/items/{product_id}", response_model=APIResponse[CartResponse])
async def update_cart_item_quantity(
    product_id: str,
    req: CartItemUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update item quantity in bucket/cart."""
    cart = await cart_crud.update_item_quantity(
        str(current_user.id), product_id=product_id, quantity=req.quantity
    )
    resp = CartResponse.model_validate(cart)
    resp.is_eligible_for_checkout = cart.items_total >= 10.0 and len(cart.items) > 0
    return APIResponse(
        success=True,
        message="Bucket item quantity updated successfully",
        data=resp,
    )


@router.delete("/items/{product_id}", response_model=APIResponse[CartResponse])
async def remove_item_from_cart(
    product_id: str,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Remove item from bucket/cart."""
    cart = await cart_crud.remove_item_from_cart(str(current_user.id), product_id=product_id)
    resp = CartResponse.model_validate(cart)
    resp.is_eligible_for_checkout = cart.items_total >= 10.0 and len(cart.items) > 0
    return APIResponse(
        success=True,
        message="Item removed from bucket successfully",
        data=resp,
    )


@router.delete("", response_model=APIResponse[CartResponse])
async def clear_cart(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Clear all items from bucket/cart."""
    cart = await cart_crud.clear_cart(str(current_user.id))
    resp = CartResponse.model_validate(cart)
    resp.is_eligible_for_checkout = False
    return APIResponse(
        success=True,
        message="Bucket cleared successfully",
        data=resp,
    )


@router.post("/checkout", response_model=APIResponse[OrderResponse], status_code=status.HTTP_201_CREATED)
async def checkout_cart(
    req: CartCheckoutRequest,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Checkout bucket/cart into an active order.
    Requires minimum order price of RS. 10 and payment method selection (UPI or Cash).
    Rings all active delivery partners within 1KM radius.
    """
    order = await cart_crud.checkout_cart(str(current_user.id), obj_in=req)
    return APIResponse(
        success=True,
        message="Bucket order placed successfully! Delivery partners within 1 KM radius are being alerted.",
        data=OrderResponse.model_validate(order),
    )
