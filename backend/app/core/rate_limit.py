"""Sliding-window rate limiter — Redis when available, else in-process memory.

IP identity: only honor X-Forwarded-For when TRUST_PROXY_HEADERS=true
(set behind a known reverse proxy that overwrites that header).
"""

from __future__ import annotations

import logging
import time
import uuid
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

from app.core.config import get_settings

logger = logging.getLogger(__name__)

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


def _check_rate_limit_memory(key: str, *, limit: int, window_seconds: float) -> None:
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


def _check_rate_limit_redis(key: str, *, limit: int, window_seconds: float) -> bool:
    """Return True if Redis handled the check; False to fall back to memory."""
    from app.services.redis_client import get_redis, redis_key

    client = get_redis()
    if client is None:
        return False

    rkey = redis_key("rl", key)
    now = time.time()
    cutoff = now - float(window_seconds)
    member = f"{now:.6f}:{uuid.uuid4().hex[:10]}"
    try:
        pipe = client.pipeline()
        pipe.zremrangebyscore(rkey, 0, cutoff)
        pipe.zcard(rkey)
        pipe.zadd(rkey, {member: now})
        pipe.expire(rkey, max(1, int(window_seconds) + 1))
        _rem, count, _add, _exp = pipe.execute()
        if int(count) >= limit:
            # Undo the add so rejected requests don't consume the budget.
            try:
                client.zrem(rkey, member)
            except Exception:
                pass
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait and try again.",
            )
        return True
    except HTTPException:
        raise
    except Exception as exc:
        logger.debug("Redis rate limit failed (%s); memory fallback", type(exc).__name__)
        return False


def check_rate_limit(key: str, *, limit: int, window_seconds: float) -> None:
    """Raise 429 if `key` exceeded `limit` events in the sliding window."""
    if _check_rate_limit_redis(key, limit=limit, window_seconds=window_seconds):
        return
    _check_rate_limit_memory(key, limit=limit, window_seconds=window_seconds)


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
