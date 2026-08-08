import asyncio
import csv
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

PARTNER_CSV_PATH = Path("uploads/partner_applications.csv")
USER_CSV_PATH = Path("uploads/user_registrations.csv")

PARTNER_HEADERS = [
    "Timestamp",
    "User ID",
    "Partner ID",
    "Full Name",
    "Email",
    "Phone",
    "DOB",
    "College",
    "Delivery Mode",
    "Current Address",
    "Permanent Address",
    "Aadhaar Number",
    "PAN Number",
    "Aadhaar URL",
    "PAN URL",
    "Selfie URL",
    "Verification Status",
    "Rejection Reason",
    "Application Fee (RS 1)",
    "Payment Method",
    "UPI Transaction ID",
]


USER_HEADERS = [
    "Timestamp",
    "User ID",
    "Full Name",
    "Email",
    "Phone",
    "DOB",
    "Gender",
    "College",
    "Address",
    "Role",
    "Is Email Verified",
    "Is Active",
]


class GoogleSheetsService:
    def __init__(self):
        self._init_local_csvs()

    def _init_local_csvs(self):
        """Ensure local CSV file backups exist with header rows."""
        try:
            PARTNER_CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
            if not PARTNER_CSV_PATH.exists():
                with open(PARTNER_CSV_PATH, "w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerow(PARTNER_HEADERS)

            if not USER_CSV_PATH.exists():
                with open(USER_CSV_PATH, "w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerow(USER_HEADERS)
        except Exception as e:
            logger.warning("Could not initialize local CSV files: %s", e)

    def _append_local_csv(self, csv_path: Path, headers: list, row_data: Dict[str, Any]):
        """Append a record row to local CSV file."""
        try:
            with open(csv_path, "a", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([row_data.get(h, "") for h in headers])
        except Exception as e:
            logger.error("Failed writing row to local CSV %s: %s", csv_path, e)

    def _update_local_csv(self, csv_path: Path, headers: list, user_id: str, updated_data: Dict[str, Any]):
        """Update an existing record in local CSV file."""
        try:
            if not csv_path.exists():
                return
            rows = []
            with open(csv_path, "r", newline="", encoding="utf-8") as f:
                reader = csv.reader(f)
                header = next(reader, None)
                if header:
                    rows.append(header)
                for r in reader:
                    if len(r) > 1 and r[1] == str(user_id):
                        r_dict = dict(zip(headers, r))
                        r_dict.update(updated_data)
                        rows.append([r_dict.get(h, "") for h in headers])
                    else:
                        rows.append(r)
            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerows(rows)
        except Exception as e:
            logger.error("Failed updating record in local CSV %s: %s", csv_path, e)

    async def _sync_gspread(self, action: str, row_data: Dict[str, Any], headers: list, worksheet_name: str):
        """Sync with Google Sheets via gspread library if configured."""
        if not settings.GOOGLE_SHEETS_SPREADSHEET_ID:
            return

        try:
            import gspread
            from google.oauth2.service_account import Credentials

            scopes = [
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive",
            ]

            client = None
            if settings.GOOGLE_SERVICE_ACCOUNT_INFO:
                info = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_INFO)
                creds = Credentials.from_service_account_info(info, scopes=scopes)
                client = gspread.authorize(creds)
            elif settings.GOOGLE_SERVICE_ACCOUNT_FILE and Path(settings.GOOGLE_SERVICE_ACCOUNT_FILE).exists():
                creds = Credentials.from_service_account_file(settings.GOOGLE_SERVICE_ACCOUNT_FILE, scopes=scopes)
                client = gspread.authorize(creds)

            if not client:
                logger.debug("Google service account credentials missing or invalid file path.")
                return

            spreadsheet = client.open_by_key(settings.GOOGLE_SHEETS_SPREADSHEET_ID)

            try:
                sheet = spreadsheet.worksheet(worksheet_name)
            except Exception:
                try:
                    sheet = spreadsheet.add_worksheet(title=worksheet_name, rows=1000, cols=20)
                except Exception:
                    sheet = spreadsheet.sheet1

            # Ensure headers exist
            existing_headers = sheet.row_values(1)
            if not existing_headers:
                sheet.append_row(headers)

            row_values = [str(row_data.get(h, "")) for h in headers]

            if action == "append":
                sheet.append_row(row_values)
                logger.info("Successfully appended data to Google Sheet (%s) for user: %s", worksheet_name, row_data.get("User ID"))
            elif action == "update":
                cell = sheet.find(str(row_data.get("User ID")))
                if cell:
                    col_letter = chr(ord('A') + len(headers) - 1)
                    sheet.update(range_name=f"A{cell.row}:{col_letter}{cell.row}", values=[row_values])
                    logger.info("Successfully updated data in Google Sheet (%s) for user: %s", worksheet_name, row_data.get("User ID"))
                else:
                    sheet.append_row(row_values)

        except Exception as err:
            logger.error("Error syncing to Google Sheet via gspread: %s", err)

    async def _sync_webhook(self, action: str, target: str, row_data: Dict[str, Any]):
        """Sync with Google Sheets via Webhook (e.g. Google Apps Script)."""
        if not settings.GOOGLE_SHEET_WEBHOOK_URL:
            return

        try:
            payload = {
                "action": action,
                "target": target,
                "data": row_data,
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(settings.GOOGLE_SHEET_WEBHOOK_URL, json=payload)
                if resp.status_code in (200, 201):
                    logger.info("Successfully synced %s data to Google Sheet Webhook for user: %s", target, row_data.get("User ID"))
                else:
                    logger.warning("Google Sheet Webhook returned status code: %s", resp.status_code)
        except Exception as err:
            logger.error("Error sending %s data to Google Sheet Webhook: %s", target, err)

    def extract_partner_row(self, user: Any) -> Dict[str, Any]:
        """Extract flat row dictionary from User document and PartnerProfile."""
        profile = getattr(user, "partner_profile", None)
        delivery_mode = getattr(profile, "delivery_mode", None)
        mode_val = delivery_mode.value if hasattr(delivery_mode, "value") else str(delivery_mode or "")
        status_val = getattr(profile, "verification_status", None)
        status_str = status_val.value if hasattr(status_val, "value") else str(status_val or "pending")

        return {
            "Timestamp": datetime.now(timezone.utc).isoformat(),
            "User ID": str(user.id),
            "Partner ID": getattr(profile, "partner_id", "") or "",
            "Full Name": user.full_name or "",
            "Email": user.email or "",
            "Phone": user.phone or getattr(profile, "phone", "") or "",
            "DOB": user.dob or getattr(profile, "dob", "") or "",
            "College": user.college or getattr(profile, "college", "") or "",
            "Delivery Mode": mode_val,
            "Current Address": getattr(profile, "current_address", "") or "",
            "Permanent Address": getattr(profile, "permanent_address", "") or "",
            "Aadhaar Number": getattr(profile, "aadhaar_number", "") or "",
            "PAN Number": getattr(profile, "pan_number", "") or "",
            "Aadhaar URL": getattr(profile, "aadhaar_url", "") or "",
            "PAN URL": getattr(profile, "pan_url", "") or "",
            "Selfie URL": getattr(profile, "selfie_url", "") or "",
            "Verification Status": status_str,
            "Rejection Reason": getattr(profile, "rejection_reason", "") or "",
            "Application Fee (RS 1)": f"RS {getattr(profile, 'application_fee_amount', 1.0):.2f} (Paid)" if getattr(profile, "application_fee_paid", True) else "Pending",
            "Payment Method": (getattr(profile, "payment_method", "upi") or "upi").upper(),
            "UPI Transaction ID": getattr(profile, "upi_transaction_id", "") or "N/A",
        }


    def extract_user_row(self, user: Any) -> Dict[str, Any]:
        """Extract flat row dictionary from customer/user Document."""
        gender_val = user.gender.value if hasattr(user.gender, "value") else str(user.gender or "")
        role_val = user.role.value if hasattr(user.role, "value") else str(user.role or "user")

        return {
            "Timestamp": datetime.now(timezone.utc).isoformat(),
            "User ID": str(user.id),
            "Full Name": user.full_name or "",
            "Email": user.email or "",
            "Phone": user.phone or "",
            "DOB": user.dob or "",
            "Gender": gender_val,
            "College": user.college or "",
            "Address": user.address or "",
            "Role": role_val,
            "Is Email Verified": "Yes" if user.is_email_verified else "No",
            "Is Active": "Yes" if user.is_active else "No",
        }

    async def sync_new_partner_application(self, user: Any):
        """Asynchronously sync new partner application to Google Sheets and local CSV."""
        row_data = self.extract_partner_row(user)
        self._append_local_csv(PARTNER_CSV_PATH, PARTNER_HEADERS, row_data)
        await asyncio.gather(
            self._sync_gspread(action="append", row_data=row_data, headers=PARTNER_HEADERS, worksheet_name=settings.GOOGLE_SHEETS_SHEET_NAME),
            self._sync_webhook(action="append", target="partner", row_data=row_data),
            return_exceptions=True,
        )

    async def sync_partner_status_update(self, user: Any):
        """Asynchronously sync updated partner status/details to Google Sheets and local CSV."""
        row_data = self.extract_partner_row(user)
        self._update_local_csv(PARTNER_CSV_PATH, PARTNER_HEADERS, str(user.id), row_data)
        await asyncio.gather(
            self._sync_gspread(action="update", row_data=row_data, headers=PARTNER_HEADERS, worksheet_name=settings.GOOGLE_SHEETS_SHEET_NAME),
            self._sync_webhook(action="update", target="partner", row_data=row_data),
            return_exceptions=True,
        )

    async def sync_new_user_registration(self, user: Any):
        """Asynchronously sync new customer user registration to Google Sheets and local CSV."""
        row_data = self.extract_user_row(user)
        self._append_local_csv(USER_CSV_PATH, USER_HEADERS, row_data)
        await asyncio.gather(
            self._sync_gspread(action="append", row_data=row_data, headers=USER_HEADERS, worksheet_name="Users"),
            self._sync_webhook(action="append", target="user", row_data=row_data),
            return_exceptions=True,
        )

    async def sync_user_status_update(self, user: Any):
        """Asynchronously sync updated customer user details/verification to Google Sheets and local CSV."""
        row_data = self.extract_user_row(user)
        self._update_local_csv(USER_CSV_PATH, USER_HEADERS, str(user.id), row_data)
        await asyncio.gather(
            self._sync_gspread(action="update", row_data=row_data, headers=USER_HEADERS, worksheet_name="Users"),
            self._sync_webhook(action="update", target="user", row_data=row_data),
            return_exceptions=True,
        )


google_sheets_service = GoogleSheetsService()

