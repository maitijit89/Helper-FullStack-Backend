from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient

from app.crud import order_crud, user_crud
from app.models.wallet import PartnerWallet, TransactionType, WalletTransaction
from app.models.withdrawal import WithdrawalStatus
from app.schemas.order import QuickCommerceOrderCreate
from app.schemas.partner import PartnerCreate
from app.services.google_sheets_service import google_sheets_service
from app.services.wallet_service import wallet_service


@pytest.fixture(autouse=True)
def mock_google_sheets(monkeypatch):
    monkeypatch.setattr(google_sheets_service, "sync_new_partner_application", AsyncMock())
    monkeypatch.setattr(google_sheets_service, "sync_partner_status_update", AsyncMock())



@pytest.mark.asyncio
async def test_order_delivery_credits_partner_wallet(
    client: AsyncClient, normal_user_token_headers: dict, admin_token_headers: dict
):
    # Step 1: Create a delivery partner
    partner_payload = {
        "name": "Wallet Partner",
        "dob": "1997-04-12",
        "email": "walletpartner@delivery.com",
        "phone": "+919777766665",
        "college": "State College",
        "current_address": "Street 9",
        "permanent_address": "Street 10",
        "delivery_mode": "bike",
        "application_fee": 1.0,
        "payment_method": "upi",
        "upi_transaction_id": "TXN-WALL-1",
    }
    signup_res = await client.post("/api/v1/auth/signup/partner", json=partner_payload)
    partner_id = signup_res.json()["data"]["id"]

    # Approve partner
    approve_res = await client.patch(
        f"/api/v1/admin/partners/{partner_id}/verify",
        json={"status": "approved"},
        headers=admin_token_headers,
    )
    assigned_partner_id = approve_res.json()["data"]["partner_id"]
    initial_password = approve_res.json()["data"]["initial_password"]

    # Partner Login
    login_res = await client.post(
        "/api/v1/auth/partner/login",
        json={"partner_id_or_email": assigned_partner_id, "password": initial_password},
    )
    token = login_res.json()["data"]["access_token"]
    partner_headers = {"Authorization": f"Bearer {token}"}

    # Check initial wallet -> Should be 0
    wallet_res1 = await client.get("/api/v1/partner/wallet", headers=partner_headers)
    assert wallet_res1.status_code == 200
    assert wallet_res1.json()["data"]["total_balance"] == 0.0

    # Step 2: Admin creates product and Customer places order
    prod_res = await client.post(
        "/api/v1/products/",
        json={
            "name": "Energy Drink 250ml",
            "category": "beverages",
            "price": 50.0,
            "unit": "can",
            "stock_quantity": 50,
            "is_available": True,
        },
        headers=admin_token_headers,
    )
    product_id = prod_res.json()["data"]["id"]

    order_req = {
        "items": [{"product_id": product_id, "quantity": 1}],
        "delivery_address": "Hostel 4, Campus",
        "customer_phone": "+919876543210",
        "payment_method": "cash",
    }
    order_res = await client.post("/api/v1/orders/quick-commerce", json=order_req, headers=normal_user_token_headers)
    assert order_res.status_code == 201

    order_id = order_res.json()["data"]["order_id"]
    delivery_fee = order_res.json()["data"]["delivery_fee"]

    # Assign order to partner and complete delivery
    order_obj = await order_crud.get_by_id(order_id)
    order_obj.partner_id = partner_id
    await order_obj.save()

    await order_crud.update_order_status(order_id=order_id, status="delivered")

    # Step 3: Check partner wallet -> Delivery fee credited!
    wallet_res2 = await client.get("/api/v1/partner/wallet", headers=partner_headers)
    assert wallet_res2.status_code == 200
    wallet_data = wallet_res2.json()["data"]
    assert wallet_data["total_balance"] == delivery_fee
    assert len(wallet_data["recent_transactions"]) >= 1
    assert wallet_data["recent_transactions"][0]["amount"] == delivery_fee


@pytest.mark.asyncio
async def test_48_hour_withdrawable_balance_holding_rule(
    client: AsyncClient, admin_token_headers: dict
):
    # Step 1: Create approved partner
    partner_payload = {
        "name": "Cooldown Driver",
        "dob": "1995-11-20",
        "email": "cooldown@delivery.com",
        "phone": "+919666655554",
        "college": "Uni Tech",
        "current_address": "Sector 5",
        "permanent_address": "Sector 6",
        "delivery_mode": "scooter",
        "application_fee": 1.0,
    }
    signup_res = await client.post("/api/v1/auth/signup/partner", json=partner_payload)
    partner_id = signup_res.json()["data"]["id"]

    approve_res = await client.patch(
        f"/api/v1/admin/partners/{partner_id}/verify",
        json={"status": "approved"},
        headers=admin_token_headers,
    )
    assigned_partner_id = approve_res.json()["data"]["partner_id"]
    initial_password = approve_res.json()["data"]["initial_password"]

    login_res = await client.post(
        "/api/v1/auth/partner/login",
        json={"partner_id_or_email": assigned_partner_id, "password": initial_password},
    )
    partner_headers = {"Authorization": f"Bearer {login_res.json()['data']['access_token']}"}

    # Step 2: Add 2 transactions manually: 1 brand new (0h old), 1 old (50h old)
    now = datetime.now(timezone.utc)
    old_time = now - timedelta(hours=50)

    # 0h old transaction (₹100)
    new_tx = WalletTransaction(
        partner_id=partner_id,
        order_id="ORD-NEW",
        amount=100.0,
        transaction_type=TransactionType.EARNING,
        description="New delivery fee",
        created_at=now,
    )
    await new_tx.insert()

    # 50h old transaction (₹150)
    old_tx = WalletTransaction(
        partner_id=partner_id,
        order_id="ORD-OLD",
        amount=150.0,
        transaction_type=TransactionType.EARNING,
        description="Old delivery fee",
        created_at=old_time,
    )
    await old_tx.insert()

    # Update total balance in wallet via wallet_service
    wallet = await wallet_service.get_or_create_partner_wallet(partner_id)
    wallet.total_balance = 250.0
    await wallet.save()

    # Step 3: Check wallet -> total_balance = 250, but withdrawable_balance = 150 (only the 50h old one!)
    res = await client.get("/api/v1/partner/wallet", headers=partner_headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["total_balance"] == 250.0
    assert data["withdrawable_balance"] == 150.0


@pytest.mark.asyncio
async def test_partner_withdrawal_request_and_admin_approval_flow(
    client: AsyncClient, admin_token_headers: dict
):
    # Step 1: Create partner and give 50h old earnings of ₹300
    partner_payload = {
        "name": "Payout Driver",
        "dob": "1994-02-14",
        "email": "payout@delivery.com",
        "phone": "+919555544443",
        "college": "National Uni",
        "current_address": "Area 1",
        "permanent_address": "Area 2",
        "delivery_mode": "car",
        "application_fee": 1.0,
    }
    signup_res = await client.post("/api/v1/auth/signup/partner", json=partner_payload)
    partner_id = signup_res.json()["data"]["id"]

    approve_res = await client.patch(
        f"/api/v1/admin/partners/{partner_id}/verify",
        json={"status": "approved"},
        headers=admin_token_headers,
    )
    assigned_partner_id = approve_res.json()["data"]["partner_id"]
    initial_password = approve_res.json()["data"]["initial_password"]

    login_res = await client.post(
        "/api/v1/auth/partner/login",
        json={"partner_id_or_email": assigned_partner_id, "password": initial_password},
    )
    partner_headers = {"Authorization": f"Bearer {login_res.json()['data']['access_token']}"}

    # Add ₹300 50h old earnings
    old_time = datetime.now(timezone.utc) - timedelta(hours=50)
    tx = WalletTransaction(
        partner_id=partner_id,
        order_id="ORD-EARN-300",
        amount=300.0,
        transaction_type=TransactionType.EARNING,
        description="Delivery fee",
        created_at=old_time,
    )
    await tx.insert()

    wallet = await wallet_service.get_or_create_partner_wallet(partner_id)
    wallet.total_balance = 300.0
    await wallet.save()


    # Step 2: Attempt withdrawal exceeding withdrawable balance -> Expect 400 Bad Request
    excess_res = await client.post(
        "/api/v1/partner/wallet/withdraw",
        json={"amount": 500.0, "payout_method": "upi", "upi_id": "driver@upi"},
        headers=partner_headers,
    )
    assert excess_res.status_code == 400
    assert "exceeds" in excess_res.json()["error"]["message"]

    # Step 3: Submit valid withdrawal request for ₹200 via UPI
    wth_res = await client.post(
        "/api/v1/partner/wallet/withdraw",
        json={"amount": 200.0, "payout_method": "upi", "upi_id": "driver@upi"},
        headers=partner_headers,
    )
    assert wth_res.status_code == 200
    wth_data = wth_res.json()["data"]
    request_id = wth_data["request_id"]
    assert wth_data["status"] == "pending"
    assert wth_data["amount"] == 200.0
    assert wth_data["upi_id"] == "driver@upi"

    # Wallet check -> pending_withdrawal_balance = 200, withdrawable_balance = 100
    w1 = await client.get("/api/v1/partner/wallet", headers=partner_headers)
    assert w1.json()["data"]["pending_withdrawal_balance"] == 200.0
    assert w1.json()["data"]["withdrawable_balance"] == 100.0

    # Step 4: Admin views pending withdrawal requests
    admin_get = await client.get("/api/v1/admin/withdrawals?status=pending", headers=admin_token_headers)
    assert admin_get.status_code == 200
    req_list = admin_get.json()["data"]
    assert any(r["request_id"] == request_id for r in req_list)

    # Step 5: Admin approves manual payout
    approve_payout = await client.patch(
        f"/api/v1/admin/withdrawals/{request_id}/approve",
        json={"status": "approved", "admin_notes": "Paid via GPay UPI", "transaction_reference": "UPI-REF-998877"},
        headers=admin_token_headers,
    )
    assert approve_payout.status_code == 200
    assert approve_payout.json()["data"]["status"] == "approved"

    # Step 6: Wallet check -> total_balance deducted to 100, total_withdrawn = 200
    w2 = await client.get("/api/v1/partner/wallet", headers=partner_headers)
    w2_data = w2.json()["data"]
    assert w2_data["total_balance"] == 100.0
    assert w2_data["pending_withdrawal_balance"] == 0.0
    assert w2_data["total_withdrawn"] == 200.0


@pytest.mark.asyncio
async def test_partner_withdrawal_rejection_flow(
    client: AsyncClient, admin_token_headers: dict
):
    # Step 1: Create partner with ₹200 50h old earnings
    partner_payload = {
        "name": "Bank Driver",
        "dob": "1993-06-10",
        "email": "bankdriver@delivery.com",
        "phone": "+919444433332",
        "college": "City Tech",
        "current_address": "Zone 1",
        "permanent_address": "Zone 2",
        "delivery_mode": "bike",
        "application_fee": 1.0,
    }
    signup_res = await client.post("/api/v1/auth/signup/partner", json=partner_payload)
    partner_id = signup_res.json()["data"]["id"]

    approve_res = await client.patch(
        f"/api/v1/admin/partners/{partner_id}/verify",
        json={"status": "approved"},
        headers=admin_token_headers,
    )
    assigned_partner_id = approve_res.json()["data"]["partner_id"]
    initial_password = approve_res.json()["data"]["initial_password"]

    login_res = await client.post(
        "/api/v1/auth/partner/login",
        json={"partner_id_or_email": assigned_partner_id, "password": initial_password},
    )
    partner_headers = {"Authorization": f"Bearer {login_res.json()['data']['access_token']}"}

    # Add ₹200 50h old earnings
    old_time = datetime.now(timezone.utc) - timedelta(hours=50)
    tx = WalletTransaction(
        partner_id=partner_id,
        order_id="ORD-BANK-200",
        amount=200.0,
        transaction_type=TransactionType.EARNING,
        description="Delivery fee",
        created_at=old_time,
    )
    await tx.insert()

    wallet = await PartnerWallet.find_one(PartnerWallet.partner_id == partner_id)
    if not wallet:
        wallet = PartnerWallet(partner_id=partner_id, total_balance=200.0)
        await wallet.insert()
    else:
        wallet.total_balance = 200.0
        await wallet.save()

    # Step 2: Submit Bank Transfer withdrawal request for ₹150
    bank_req = {
        "amount": 150.0,
        "payout_method": "bank_transfer",
        "bank_account_number": "123456789012",
        "ifsc_code": "SBIN0001234",
        "account_holder_name": "Bank Driver",
    }
    wth_res = await client.post("/api/v1/partner/wallet/withdraw", json=bank_req, headers=partner_headers)
    assert wth_res.status_code == 200
    request_id = wth_res.json()["data"]["request_id"]

    # Step 3: Admin rejects payout request
    reject_res = await client.patch(
        f"/api/v1/admin/withdrawals/{request_id}/approve",
        json={"status": "rejected", "admin_notes": "Invalid Bank Account Details"},
        headers=admin_token_headers,
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["data"]["status"] == "rejected"

    # Step 4: Wallet check -> locked pending balance released, total_balance remains ₹200
    w_check = await client.get("/api/v1/partner/wallet", headers=partner_headers)
    w_data = w_check.json()["data"]
    assert w_data["total_balance"] == 200.0
    assert w_data["pending_withdrawal_balance"] == 0.0
    assert w_data["withdrawable_balance"] == 200.0


@pytest.mark.asyncio
async def test_regular_user_cannot_access_partner_wallet(
    client: AsyncClient,
    normal_user_token_headers: dict,
):
    """Ensure regular customer users are forbidden (403) from partner wallet endpoints."""
    # 1. Try accessing partner wallet balance
    res_wallet = await client.get("/api/v1/partner/wallet", headers=normal_user_token_headers)
    assert res_wallet.status_code == 403

    # 2. Try requesting withdrawal
    res_withdraw = await client.post(
        "/api/v1/partner/wallet/withdraw",
        json={"amount": 50.0, "payout_method": "upi", "upi_id": "test@upi"},
        headers=normal_user_token_headers,
    )
    assert res_withdraw.status_code == 403

    # 3. Try viewing withdrawals list
    res_list = await client.get("/api/v1/partner/wallet/withdrawals", headers=normal_user_token_headers)
    assert res_list.status_code == 403

    # 4. Try viewing earnings history
    res_history = await client.get("/api/v1/partner/wallet/earnings-history", headers=normal_user_token_headers)
    assert res_history.status_code == 403

