"""Email OTP delivery via SMTP (Gmail / Mailpit) with optional console log."""

from __future__ import annotations

import logging

import aiosmtplib
from email.message import EmailMessage

from app.core.config import get_settings
from app.core.otp import generate_otp

logger = logging.getLogger(__name__)

__all__ = ["generate_otp", "send_otp_email"]


async def send_otp_email(email: str, code: str) -> None:
    settings = get_settings()
    if settings.otp_dev_log:
        # Dev-only: never enable in production (boot guard enforces this).
        logger.warning("OTP_DEV_LOG enabled — printing code for %s", email)
        print(f"[DEV OTP] {email} -> {code}")

    message = EmailMessage()
    message["From"] = settings.smtp_sender
    message["To"] = email
    message["Subject"] = f"{settings.app_name} verification code"
    message.set_content(
        f"Your {settings.app_name} email verification code is: {code}\n\n"
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
            type(exc).__name__,
            "was logged" if settings.otp_dev_log else "was NOT delivered",
        )
        if not settings.otp_dev_log:
            raise
