from fastapi import APIRouter
from app.api.v1.endpoints import admin, auth, health, orders, partner, products, users

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(partner.router, prefix="/partner", tags=["Partner"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(orders.router, prefix="/orders", tags=["Orders"])
