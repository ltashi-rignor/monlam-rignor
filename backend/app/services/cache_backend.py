"""JSON TTL cache: memory L1 + optional Redis L2 (shared, survives restarts)."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.services.ttl_cache import TTLCache

logger = logging.getLogger(__name__)


class JsonTTLCache:
    """Drop-in for string-keyed TTL caches used by grammar / RAG.

    - Always writes/reads a local memory cache (fast L1, size-capped).
    - When Redis is up, also stores JSON under ``namespace:key`` with the same TTL.
    - Fail-open: Redis errors never break the request path.
    """

    def __init__(
        self,
        *,
        namespace: str,
        maxsize: int = 128,
        ttl_s: float = 600.0,
    ) -> None:
        self.namespace = namespace
        self.ttl_s = max(1.0, float(ttl_s))
        self._mem: TTLCache[str, Any] = TTLCache(maxsize=maxsize, ttl_s=ttl_s)

    def _redis_key(self, key: str) -> str:
        from app.services.redis_client import redis_key

        return redis_key("cache", self.namespace, key)

    def get(self, key: str) -> Any | None:
        hit = self._mem.get(key)
        if hit is not None:
            return hit

        from app.services.redis_client import get_redis

        client = get_redis()
        if client is None:
            return None
        try:
            raw = client.get(self._redis_key(key))
            if raw is None:
                return None
            value = json.loads(raw)
            self._mem.set(key, value)
            return value
        except Exception as exc:
            logger.debug("Redis cache get failed (%s)", type(exc).__name__)
            return None

    def set(self, key: str, value: Any) -> None:
        self._mem.set(key, value)

        from app.services.redis_client import get_redis

        client = get_redis()
        if client is None:
            return
        try:
            payload = json.dumps(value, ensure_ascii=False, default=str)
            client.setex(self._redis_key(key), int(self.ttl_s), payload)
        except Exception as exc:
            logger.debug("Redis cache set failed (%s)", type(exc).__name__)

    def clear(self) -> None:
        self._mem.clear()
