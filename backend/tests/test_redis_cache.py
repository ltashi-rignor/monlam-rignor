"""Optional Redis cache — memory works without Redis; Redis path fail-open."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.services.cache_backend import JsonTTLCache
from app.services.redis_client import redis_key, reset_redis_client


def test_json_ttl_cache_memory_without_redis():
    reset_redis_client()
    with patch("app.services.redis_client.get_redis", return_value=None):
        c = JsonTTLCache(namespace="test", maxsize=8, ttl_s=60)
        c.set("k1", {"a": 1})
        assert c.get("k1") == {"a": 1}


def test_json_ttl_cache_reads_redis_when_memory_cold():
    reset_redis_client()
    fake = MagicMock()
    fake.get.return_value = '{"x": 2}'
    with patch("app.services.redis_client.get_redis", return_value=fake):
        c = JsonTTLCache(namespace="test", maxsize=8, ttl_s=60)
        assert c.get("cold") == {"x": 2}
        fake.get.assert_called()
        # L1 warm — second get should not need Redis
        fake.get.reset_mock()
        assert c.get("cold") == {"x": 2}
        fake.get.assert_not_called()


def test_json_ttl_cache_writes_redis():
    reset_redis_client()
    fake = MagicMock()
    with patch("app.services.redis_client.get_redis", return_value=fake):
        c = JsonTTLCache(namespace="grammar-result", maxsize=8, ttl_s=1800)
        c.set("abc", {"ok": True})
        fake.setex.assert_called_once()
        args = fake.setex.call_args[0]
        assert args[1] == 1800
        assert '"ok": true' in args[2] or '"ok":true' in args[2].replace(" ", "")


def test_json_ttl_cache_redis_errors_fail_open():
    reset_redis_client()
    fake = MagicMock()
    fake.get.side_effect = RuntimeError("boom")
    fake.setex.side_effect = RuntimeError("boom")
    with patch("app.services.redis_client.get_redis", return_value=fake):
        c = JsonTTLCache(namespace="test", maxsize=8, ttl_s=60)
        assert c.get("missing") is None
        c.set("k", {"v": 1})
        assert c.get("k") == {"v": 1}


def test_redis_key_prefix():
    with patch("app.core.config.get_settings") as gs:
        gs.return_value.redis_prefix = "mr"
        assert redis_key("cache", "grammar-result", "abc").startswith("mr:cache:")
