"""OTP generation and hashing (never store plaintext codes)."""

from __future__ import annotations

import hashlib
import hmac
import secrets

from app.core.config import get_settings


def generate_otp(length: int = 6) -> str:
    upper = 10**length
    return str(secrets.randbelow(upper)).zfill(length)


def hash_otp(email: str, code: str) -> str:
    settings = get_settings()
    material = f"{email.lower().strip()}:{code.strip()}".encode("utf-8")
    digest = hmac.new(
        settings.jwt_secret.encode("utf-8"),
        material,
        hashlib.sha256,
    ).hexdigest()
    return digest


def verify_otp_hash(email: str, code: str, stored: str | None) -> bool:
    if not stored:
        return False
    candidate = hash_otp(email, code)
    return secrets.compare_digest(candidate, stored)
