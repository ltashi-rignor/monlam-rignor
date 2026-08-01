"""Password hashing helpers (PBKDF2 — no extra native deps)."""

from __future__ import annotations

import hashlib
import re
import secrets

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")
_ITERATIONS = 120_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        _ITERATIONS,
    )
    return f"pbkdf2_sha256${_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored or not password:
        return False
    try:
        algo, iterations_s, salt, hash_hex = stored.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations_s),
        )
        return secrets.compare_digest(digest.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


def normalize_username(username: str) -> str:
    return username.strip().lower()


def validate_username(username: str) -> str:
    cleaned = normalize_username(username)
    if not USERNAME_RE.match(cleaned):
        raise ValueError(
            "Username must be 3–32 characters: letters, numbers, underscore only"
        )
    return cleaned
