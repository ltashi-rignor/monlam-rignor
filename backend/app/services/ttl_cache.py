"""Simple thread-safe in-process TTL cache (memory L1; see cache_backend for Redis)."""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from typing import Any, Generic, TypeVar

K = TypeVar("K")
V = TypeVar("V")


class TTLCache(Generic[K, V]):
    def __init__(self, *, maxsize: int = 128, ttl_s: float = 600.0) -> None:
        self.maxsize = max(1, int(maxsize))
        self.ttl_s = max(0.01, float(ttl_s))
        self._data: OrderedDict[K, tuple[float, V]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: K) -> V | None:
        now = time.monotonic()
        with self._lock:
            item = self._data.get(key)
            if item is None:
                return None
            expires, value = item
            if expires <= now:
                self._data.pop(key, None)
                return None
            self._data.move_to_end(key)
            return value

    def set(self, key: K, value: V) -> None:
        now = time.monotonic()
        with self._lock:
            self._data[key] = (now + self.ttl_s, value)
            self._data.move_to_end(key)
            while len(self._data) > self.maxsize:
                self._data.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()


def stable_hash(parts: list[Any]) -> str:
    """Deterministic short key from JSON-ish parts."""
    import hashlib
    import json

    raw = json.dumps(parts, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]
