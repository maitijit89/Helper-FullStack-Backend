from typing import AsyncGenerator
from beanie import init_beanie
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient
import pytest
import app.core.database as db_module
from app.core.security import create_access_token
from app.crud import user_crud
from app.core.config import settings
from app.main import ALL_MODELS, app
from app.models import (
    OTP,
    Cart,
    Feedback,
    Order,
    PartnerWallet,
    Product,
    Rating,
    SupportTicket,
    User,
    WalletTransaction,
    WithdrawalRequest,
)
from app.schemas.gender import Gender
from app.schemas.role import UserRole
from app.schemas.user import CustomerUserCreate

settings.ENVIRONMENT = "testing"
settings.DEBUG = True



@pytest.fixture(scope="session", autouse=True)
def anyio_backend():
    return "asyncio"



@pytest.fixture(scope="function", autouse=True)
async def init_test_db():
    """Initialize mock MongoDB client & Beanie for testing."""
    client = AsyncMongoMockClient()
    db_module.motor_client = client
    db_module.is_initialized = True
    await init_beanie(
        database=client.get_database("fastapi_test_db"),
        document_models=ALL_MODELS,
    )
    yield
    # Clean up collections after test
    await User.delete_all()
    await OTP.delete_all()
    await Product.delete_all()
    await Order.delete_all()
    await Cart.delete_all()
    await Rating.delete_all()
    await Feedback.delete_all()
    await SupportTicket.delete_all()
    await PartnerWallet.delete_all()
    await WalletTransaction.delete_all()
    await WithdrawalRequest.delete_all()
    db_module.motor_client = None
    db_module.is_initialized = False






@pytest.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Fixture providing AsyncClient for API testing."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as c:
        yield c


@pytest.fixture(scope="function")
async def test_user():
    """Fixture providing a customer test user."""
    user_in = CustomerUserCreate(
        name="Test Customer",
        dob="2000-01-15",
        gender=Gender.MALE,
        email="testuser@example.com",
        phone="+919876543210",
        college="Institute of Technology",
        address="123 Main Street, City",
        password="TestPassword123!",
    )
    return await user_crud.create_customer(obj_in=user_in)


@pytest.fixture(scope="function")
async def normal_user_token_headers(test_user) -> dict[str, str]:
    """Fixture providing Auth headers for customer user."""
    access_token = create_access_token(subject=str(test_user.id), role=UserRole.USER)
    return {"Authorization": f"Bearer {access_token}"}


from app.schemas.partner import DeliveryMode, PartnerCreate, PartnerVerificationStatus


@pytest.fixture(scope="function")
async def partner_user():
    """Fixture providing an approved delivery partner user."""
    partner_in = PartnerCreate(
        name="Test Partner Driver",
        dob="1998-05-12",
        email="partner@example.com",
        phone="+919876543299",
        college="Tech Institute",
        current_address="12 Park Street",
        permanent_address="45 Green Avenue",
        delivery_mode=DeliveryMode.CYCLE,
    )
    partner = await user_crud.create_partner_application(obj_in=partner_in)
    approved_partner, _, _ = await user_crud.approve_partner(db_obj=partner)
    from app.schemas.location import GPSLocation
    approved_partner.is_gps_enabled = True
    approved_partner.location = GPSLocation(latitude=19.0760, longitude=72.8770, is_gps_enabled=True)
    await approved_partner.save()
    return approved_partner


@pytest.fixture(scope="function")
async def partner_token_headers(partner_user) -> dict[str, str]:
    """Fixture providing Auth headers for delivery partner."""
    access_token = create_access_token(
        subject=str(partner_user.id), role=UserRole.PARTNER
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture(scope="function")
async def admin_user():
    """Fixture providing an Admin user."""
    existing = await user_crud.get_by_email(email="admin@example.com")
    if existing:
        existing.role = UserRole.ADMIN
        existing.is_superuser = True
        await existing.save()
        return existing

    user_in = CustomerUserCreate(
        name="System Admin",
        dob="1990-05-20",
        gender=Gender.FEMALE,
        email="admin@example.com",
        phone="+919999988888",
        college="Tech University",
        address="Admin HQ",
    )
    admin = await user_crud.create_customer(obj_in=user_in)
    admin.role = UserRole.ADMIN
    admin.is_superuser = True
    await admin.save()
    return admin



@pytest.fixture(scope="function")
async def admin_token_headers(admin_user) -> dict[str, str]:
    """Fixture providing Auth headers for Admin user."""
    access_token = create_access_token(
        subject=str(admin_user.id), role=UserRole.ADMIN
    )
    return {"Authorization": f"Bearer {access_token}"}
