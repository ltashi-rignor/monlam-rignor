"""Optional Redis client — fail-open when REDIS_URL unset or Redis is down."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_client: Any | None = None
_client_url: str = ""
_next_retry_at: float = 0.0
_RETRY_AFTER_S = 15.0


def reset_redis_client() -> None:
    """Test helper / reconnect after URL change."""
    global _client, _client_url, _next_retry_at
    with _lock:
        if _client is not None:
            try:
                _client.close()
            except Exception:
                pass
        _client = None
        _client_url = ""
        _next_retry_at = 0.0


def redis_configured() -> bool:
    from app.core.config import get_settings

    return bool((get_settings().redis_url or "").strip())


def get_redis() -> Any | None:
    """Return a sync Redis client, or None if disabled / unreachable."""
    global _client, _client_url, _next_retry_at

    from app.core.config import get_settings

    url = (get_settings().redis_url or "").strip()
    if not url:
        return None

    with _lock:
        if _client is not None and _client_url == url:
            return _client
        if _client is not None:
            try:
                _client.close()
            except Exception:
                pass
            _client = None
            _client_url = ""

        now = time.monotonic()
        if now < _next_retry_at:
            return None

        try:
            import redis

            client = redis.Redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=0.75,
                socket_timeout=0.75,
                health_check_interval=30,
            )
            client.ping()
            _client = client
            _client_url = url
            _next_retry_at = 0.0
            logger.info("Redis connected (%s)", url.split("@")[-1])
            return _client
        except Exception as exc:
            _client = None
            _client_url = ""
            _next_retry_at = now + _RETRY_AFTER_S
            logger.warning(
                "Redis unavailable (%s); memory fallback (retry in %ss)",
                type(exc).__name__,
                int(_RETRY_AFTER_S),
            )
            return None


def redis_key(*parts: str) -> str:
    from app.core.config import get_settings

    prefix = (get_settings().redis_prefix or "mr").strip() or "mr"
    return ":".join([prefix, *[str(p) for p in parts if p is not None]])


def redis_ping() -> str:
    """Health status: ok | not_configured | error:<name>."""
    if not redis_configured():
        return "not_configured"
    client = get_redis()
    if client is None:
        return "error:unreachable"
    try:
        client.ping()
        return "ok"
    except Exception as exc:
        return f"error:{type(exc).__name__}"
