import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import smtplib
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    def _send_mail_sync(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        """Synchronous helper method to connect to SMTP server and send email."""
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.warning(
                "SMTP credentials not fully configured. Email to %s skipped.",
                to_email,
            )
            return False

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
        message["To"] = to_email

        if text_content:
            message.attach(MIMEText(text_content, "plain", "utf-8"))
        
        message.attach(MIMEText(html_content, "html", "utf-8"))

        try:
            # Clean password by stripping spaces if present
            clean_password = settings.SMTP_PASSWORD.replace(" ", "")
            
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                server.login(settings.SMTP_USER, clean_password)
                server.sendmail(settings.EMAILS_FROM_EMAIL, [to_email], message.as_string())
            
            logger.info("Successfully sent email '%s' to '%s'", subject, to_email)
            return True
        except Exception as exc:
            logger.error("Failed to send email to '%s' via SMTP: %s", to_email, exc, exc_info=True)
            return False

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        """Asynchronously send an email without blocking the FastAPI event loop."""
        return await asyncio.to_thread(
            self._send_mail_sync,
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )

    async def send_otp_email(
        self,
        to_email: str,
        otp_code: str,
        purpose: str = "Verification",
    ) -> bool:
        """Send a beautifully formatted OTP verification email."""
        subject = f"{otp_code} is your verification code"

        text_content = (
            f"Hello,\n\n"
            f"Your verification code for {purpose} is: {otp_code}\n"
            f"This code will expire in 10 minutes.\n\n"
            f"If you did not request this code, please ignore this email.\n\n"
            f"Best regards,\n"
            f"{settings.EMAILS_FROM_NAME}"
        )

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    background-color: #f4f6f9;
                    margin: 0;
                    padding: 40px 20px;
                }}
                .container {{
                    max-width: 500px;
                    margin: 0 auto;
                    background: #ffffff;
                    border-radius: 12px;
                    padding: 32px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                    border: 1px solid #e1e8ed;
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 24px;
                }}
                .header h2 {{
                    color: #1e293b;
                    margin: 0;
                    font-size: 22px;
                    font-weight: 700;
                }}
                .otp-box {{
                    background: #f8fafc;
                    border: 2px dashed #cbd5e1;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    margin: 24px 0;
                }}
                .otp-code {{
                    font-size: 36px;
                    font-weight: 800;
                    letter-spacing: 8px;
                    color: #2563eb;
                    font-family: 'Courier New', Courier, monospace;
                    margin: 0;
                }}
                .details {{
                    color: #475569;
                    font-size: 15px;
                    line-height: 1.6;
                    text-align: center;
                }}
                .footer {{
                    margin-top: 32px;
                    padding-top: 16px;
                    border-top: 1px solid #e2e8f0;
                    text-align: center;
                    color: #94a3b8;
                    font-size: 13px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>{settings.EMAILS_FROM_NAME}</h2>
                </div>
                <p class="details">Use the verification code below to complete your <strong>{purpose}</strong> process:</p>
                <div class="otp-box">
                    <p class="otp-code">{otp_code}</p>
                </div>
                <p class="details">This code will expire in <strong>10 minutes</strong>. Please do not share this code with anyone.</p>
                <div class="footer">
                    <p>&copy; {settings.EMAILS_FROM_NAME}. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )


email_service = EmailService()
