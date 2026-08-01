"""Unit tests for OTP hashing, passwords, and rate limiting (no DB required)."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.otp import generate_otp, hash_otp, verify_otp_hash
from app.core.passwords import hash_password, validate_username, verify_password
from app.core.rate_limit import check_rate_limit
from app.core.security import hash_refresh_token, mint_refresh_token_raw


def test_generate_otp_length_and_digits():
    code = generate_otp(6)
    assert len(code) == 6
    assert code.isdigit()


def test_otp_hash_roundtrip():
    email = "learner@example.com"
    code = "123456"
    digest = hash_otp(email, code)
    assert verify_otp_hash(email, code, digest)
    assert not verify_otp_hash(email, "000000", digest)
    assert not verify_otp_hash("other@example.com", code, digest)


def test_password_hash_roundtrip():
    stored = hash_password("secret123")
    assert verify_password("secret123", stored)
    assert not verify_password("wrong", stored)


def test_username_validation():
    assert validate_username("Lobsang_1") == "lobsang_1"
    with pytest.raises(ValueError):
        validate_username("ab")
    with pytest.raises(ValueError):
        validate_username("bad name!")


def test_rate_limit_trips():
    key = "test:unit:rate"
    for _ in range(3):
        check_rate_limit(key, limit=3, window_seconds=60)
    with pytest.raises(HTTPException) as exc:
        check_rate_limit(key, limit=3, window_seconds=60)
    assert exc.value.status_code == 429


def test_refresh_token_hash_roundtrip():
    raw = mint_refresh_token_raw()
    digest = hash_refresh_token(raw)
    assert digest == hash_refresh_token(raw)
    assert digest != hash_refresh_token(raw + "x")
