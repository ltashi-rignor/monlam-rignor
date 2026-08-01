"""HttpOnly session cookies for access + refresh tokens."""

from __future__ import annotations

from fastapi import Response

from app.core.config import get_settings

ACCESS_COOKIE = "mr_access"
REFRESH_COOKIE = "mr_refresh"


def _secure() -> bool:
    return get_settings().is_production


def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    refresh_token: str | None,
) -> None:
    settings = get_settings()
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        secure=_secure(),
        samesite="lax",
        max_age=max(60, settings.jwt_expire_minutes * 60),
        path="/",
    )
    if refresh_token:
        response.set_cookie(
            key=REFRESH_COOKIE,
            value=refresh_token,
            httponly=True,
            secure=_secure(),
            samesite="lax",
            max_age=max(3600, settings.jwt_refresh_expire_days * 86400),
            path="/",
        )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/")
