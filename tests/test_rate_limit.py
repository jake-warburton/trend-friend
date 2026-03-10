"""Tests for rate limiting and response caching."""

from __future__ import annotations

import unittest

from app.api.rate_limit import RateLimiter, ResponseCache


class RateLimiterTests(unittest.TestCase):
    """Test the sliding window rate limiter."""

    def test_allows_within_limit(self) -> None:
        limiter = RateLimiter(requests_per_minute=5)
        for _ in range(5):
            allowed, remaining = limiter.check("client-1")
            self.assertTrue(allowed)
        self.assertEqual(remaining, 0)

    def test_blocks_over_limit(self) -> None:
        limiter = RateLimiter(requests_per_minute=3)
        for _ in range(3):
            limiter.check("client-1")
        allowed, remaining = limiter.check("client-1")
        self.assertFalse(allowed)
        self.assertEqual(remaining, 0)

    def test_separate_keys_independent(self) -> None:
        limiter = RateLimiter(requests_per_minute=2)
        limiter.check("client-1")
        limiter.check("client-1")
        allowed, _ = limiter.check("client-2")
        self.assertTrue(allowed)

    def test_cleanup_removes_expired(self) -> None:
        import time
        limiter = RateLimiter(requests_per_minute=5)
        limiter.check("client-1")
        # Manually expire all timestamps to far in the past
        now = time.monotonic()
        for bucket in limiter._buckets.values():
            bucket.timestamps = [now - 120.0]
        limiter.cleanup()
        self.assertEqual(len(limiter._buckets), 0)


class ResponseCacheTests(unittest.TestCase):
    """Test the TTL response cache."""

    def test_set_and_get(self) -> None:
        cache = ResponseCache(default_ttl_seconds=60.0)
        cache.set("key1", {"data": "value"})
        result = cache.get("key1")
        self.assertEqual(result, {"data": "value"})

    def test_miss_returns_none(self) -> None:
        cache = ResponseCache()
        self.assertIsNone(cache.get("nonexistent"))

    def test_expired_entry_returns_none(self) -> None:
        cache = ResponseCache(default_ttl_seconds=0.0)
        cache.set("key1", {"data": "value"}, ttl=0.0)
        import time
        time.sleep(0.01)
        self.assertIsNone(cache.get("key1"))

    def test_invalidate_key(self) -> None:
        cache = ResponseCache()
        cache.set("key1", "data1")
        cache.set("key2", "data2")
        cache.invalidate("key1")
        self.assertIsNone(cache.get("key1"))
        self.assertEqual(cache.get("key2"), "data2")

    def test_invalidate_prefix(self) -> None:
        cache = ResponseCache()
        cache.set("/api/v1/trends", "data1")
        cache.set("/api/v1/trends/latest", "data2")
        cache.set("/api/v1/sources", "data3")
        cache.invalidate_prefix("/api/v1/trends")
        self.assertIsNone(cache.get("/api/v1/trends"))
        self.assertIsNone(cache.get("/api/v1/trends/latest"))
        self.assertEqual(cache.get("/api/v1/sources"), "data3")

    def test_clear(self) -> None:
        cache = ResponseCache()
        cache.set("key1", "data1")
        cache.set("key2", "data2")
        cache.clear()
        self.assertIsNone(cache.get("key1"))
        self.assertIsNone(cache.get("key2"))
