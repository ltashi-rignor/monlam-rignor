"""In-process TTL cache used by grammar check."""

from __future__ import annotations

import time

from app.services.ttl_cache import TTLCache, stable_hash


def test_ttl_cache_get_set_and_evict():
    c: TTLCache[str, int] = TTLCache(maxsize=2, ttl_s=60)
    c.set("a", 1)
    c.set("b", 2)
    # Touch "a" so "b" becomes oldest.
    assert c.get("a") == 1
    c.set("c", 3)  # evicts "b"
    assert c.get("a") == 1
    assert c.get("b") is None
    assert c.get("c") == 3


def test_ttl_cache_expires():
    c: TTLCache[str, str] = TTLCache(maxsize=8, ttl_s=0.05)
    c.set("k", "v")
    assert c.get("k") == "v"
    time.sleep(0.08)
    assert c.get("k") is None


def test_stable_hash_deterministic():
    assert stable_hash(["a", {"b": 1}]) == stable_hash(["a", {"b": 1}])
    assert stable_hash(["a"]) != stable_hash(["b"])
