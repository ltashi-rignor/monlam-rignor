"""In-process sliding-window rate limiter (per-key).

IP identity: only honor X-Forwarded-For when TRUST_PROXY_HEADERS=true
(set behind a known reverse proxy that overwrites that header).
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

from app.core.config import get_settings

_lock = Lock()
_buckets: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    settings = get_settings()
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip() or "unknown"
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip() or "unknown"
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


def check_rate_limit(key: str, *, limit: int, window_seconds: float) -> None:
    """Raise 429 if `key` exceeded `limit` events in the sliding window."""
    now = time.monotonic()
    cutoff = now - window_seconds
    with _lock:
        q = _buckets[key]
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait and try again.",
            )
        q.append(now)


def rate_limit_auth(request: Request, *, action: str, email: str | None = None) -> None:
    ip = _client_ip(request)
    check_rate_limit(f"auth:{action}:ip:{ip}", limit=20, window_seconds=60)
    if email:
        check_rate_limit(f"auth:{action}:email:{email.lower()}", limit=5, window_seconds=600)


def rate_limit_llm(request: Request, user_id: str) -> None:
    ip = _client_ip(request)
    check_rate_limit(f"llm:ip:{ip}", limit=60, window_seconds=60)
    check_rate_limit(f"llm:user:{user_id}", limit=30, window_seconds=60)


def rate_limit_voice(request: Request, user_id: str) -> None:
    """Stricter caps for TTS/STT (paid upstream)."""
    ip = _client_ip(request)
    check_rate_limit(f"voice:ip:{ip}", limit=30, window_seconds=60)
    check_rate_limit(f"voice:user:{user_id}", limit=20, window_seconds=60)


def rate_limit_public(request: Request, *, action: str, limit: int = 10) -> None:
    ip = _client_ip(request)
    check_rate_limit(f"public:{action}:ip:{ip}", limit=limit, window_seconds=60)
