"""Email OTP delivery — SMTP (Mailpit locally) with console fallback."""

from __future__ import annotations

import logging
import random
import string

import aiosmtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


async def send_otp_email(email: str, code: str) -> None:
    settings = get_settings()
    if settings.otp_dev_log:
        logger.info("OTP for %s: %s", email, code)
        print(f"[DEV OTP] {email} -> {code}")

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = email
    message["Subject"] = f"{settings.app_name} login code"
    message.set_content(
        f"Your {settings.app_name} login code is: {code}\n\n"
        f"It expires in {settings.otp_expire_minutes} minutes.\n"
        "If you did not request this, ignore this email."
    )

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            start_tls=False,
        )
    except Exception as exc:
        # Local dev without Mailpit: OTP still available via OTP_DEV_LOG
        logger.warning("SMTP send failed (%s); OTP logged for local development.", exc)
