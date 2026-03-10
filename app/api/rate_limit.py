"""In-memory rate limiting and response caching for the API."""

from __future__ import annotations

import time
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any


@dataclass
class _RateBucket:
    """Sliding window rate limit tracker."""

    timestamps: list[float] = field(default_factory=list)


class RateLimiter:
    """Thread-safe in-memory sliding window rate limiter."""

    def __init__(self, requests_per_minute: int = 60) -> None:
        self.requests_per_minute = requests_per_minute
        self._buckets: dict[str, _RateBucket] = defaultdict(_RateBucket)
        self._lock = threading.Lock()

    def check(self, key: str) -> tuple[bool, int]:
        """Check if a request is allowed.

        Returns (allowed, remaining_requests).
        """

        now = time.monotonic()
        window_start = now - 60.0

        with self._lock:
            bucket = self._buckets[key]
            bucket.timestamps = [t for t in bucket.timestamps if t > window_start]
            if len(bucket.timestamps) >= self.requests_per_minute:
                return False, 0
            bucket.timestamps.append(now)
            remaining = self.requests_per_minute - len(bucket.timestamps)
            return True, remaining

    def cleanup(self) -> None:
        """Remove expired buckets."""

        now = time.monotonic()
        window_start = now - 60.0

        with self._lock:
            expired_keys = [
                key for key, bucket in self._buckets.items()
                if all(t <= window_start for t in bucket.timestamps)
            ]
            for key in expired_keys:
                del self._buckets[key]

    def clear(self) -> None:
        """Remove all tracked buckets."""

        with self._lock:
            self._buckets.clear()


@dataclass
class _CacheEntry:
    """Cached response with expiry."""

    data: Any
    expires_at: float


class ResponseCache:
    """Thread-safe in-memory TTL cache for API responses."""

    def __init__(self, default_ttl_seconds: float = 30.0) -> None:
        self.default_ttl = default_ttl_seconds
        self._entries: dict[str, _CacheEntry] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        """Return cached data if present and not expired."""

        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None or entry.expires_at < now:
                if entry is not None:
                    del self._entries[key]
                return None
            return entry.data

    def set(self, key: str, data: Any, ttl: float | None = None) -> None:
        """Store data in the cache with a TTL."""

        ttl = ttl if ttl is not None else self.default_ttl
        expires_at = time.monotonic() + ttl
        with self._lock:
            self._entries[key] = _CacheEntry(data=data, expires_at=expires_at)

    def invalidate(self, key: str) -> None:
        """Remove a cache entry."""

        with self._lock:
            self._entries.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> None:
        """Remove all cache entries matching a prefix."""

        with self._lock:
            keys_to_remove = [k for k in self._entries if k.startswith(prefix)]
            for key in keys_to_remove:
                del self._entries[key]

    def clear(self) -> None:
        """Remove all cache entries."""

        with self._lock:
            self._entries.clear()

    def cleanup(self) -> None:
        """Remove expired entries."""

        now = time.monotonic()
        with self._lock:
            expired = [k for k, v in self._entries.items() if v.expires_at < now]
            for key in expired:
                del self._entries[key]


# Global instances
rate_limiter = RateLimiter(requests_per_minute=60)
response_cache = ResponseCache(default_ttl_seconds=30.0)
