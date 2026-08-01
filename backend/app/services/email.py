"""Email OTP delivery via SMTP (Gmail / Mailpit) with optional console log."""

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
    message["From"] = settings.smtp_sender
    message["To"] = email
    message["Subject"] = f"{settings.app_name} login code"
    message.set_content(
        f"Your {settings.app_name} login code is: {code}\n\n"
        f"It expires in {settings.otp_expire_minutes} minutes.\n"
        "If you did not request this, ignore this email."
    )

    kwargs: dict = {
        "hostname": settings.smtp_host,
        "port": int(settings.smtp_port),
        "start_tls": settings.smtp_start_tls,
    }
    if settings.smtp_user and settings.smtp_password:
        kwargs["username"] = settings.smtp_user
        kwargs["password"] = settings.smtp_password

    try:
        await aiosmtplib.send(message, **kwargs)
        logger.info(
            "OTP email sent to %s via %s:%s",
            email,
            settings.smtp_host,
            settings.smtp_port,
        )
    except Exception as exc:
        logger.warning(
            "SMTP send failed (%s); OTP %s for local development.",
            exc,
            "was logged" if settings.otp_dev_log else "was NOT delivered",
        )
        if not settings.otp_dev_log:
            # Surface failure when we are not relying on console OTP
            raise
