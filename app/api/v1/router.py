from fastapi import APIRouter
from app.api.v1.endpoints import (
    admin,
    admin_dashboard,
    ai_chat,
    assignment_service,
    auth,
    cart,
    health,
    orders,
    partner,
    payments,
    print_service,
    products,
    ratings,
    support,
    users,
    wallet,
    ws,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(partner.router, prefix="/partner", tags=["Partner"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(admin_dashboard.router, prefix="/admin/dashboard", tags=["Admin Realtime Analytics & Operations Dashboard"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(orders.router, prefix="/orders", tags=["Orders"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments & Razorpay Gateway"])
api_router.include_router(ratings.router, prefix="/ratings", tags=["Partner Ratings & Reviews"])
api_router.include_router(cart.router, prefix="/cart", tags=["Bucket / Cart"])
api_router.include_router(print_service.router, prefix="/print", tags=["Xerox / Print Service"])
api_router.include_router(assignment_service.router, prefix="/assignment-service", tags=["Assignment Writer Service"])
api_router.include_router(ai_chat.router, prefix="/ai", tags=["AI Support Assistant"])
api_router.include_router(support.router, prefix="/support", tags=["Customer Support & Reports"])
api_router.include_router(wallet.router, tags=["Partner Wallet & Withdrawals"])
api_router.include_router(ws.router, prefix="/ws", tags=["WebSockets"])
