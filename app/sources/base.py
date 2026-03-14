"""Shared source adapter helpers."""

from __future__ import annotations

import json
import logging
from time import sleep
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import Settings
from app.models import RawSourceItem

LOGGER = logging.getLogger(__name__)
_REQUEST_CACHE: dict[tuple[str, str], tuple[float, bytes]] = {}


class SourceAdapter(ABC):
    """Base class for source adapters with resilient fallbacks."""

    source_name: str

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.used_fallback = False
        self.raw_item_count = 0
        self.kept_item_count = 0

    @abstractmethod
    def fetch(self) -> list[RawSourceItem]:
        """Return normalized items from the source."""

    def get_url(self, url: str, headers: Optional[Dict[str, str]] = None) -> bytes:
        """Fetch raw bytes from a URL, preferring requests over urllib."""

        cache_key = self._cache_key(url, headers)
        cached = self._read_cached_response(cache_key)
        if cached is not None:
            return cached

        last_error: Exception | None = None
        for attempt in range(max(1, self.settings.request_retry_count) + 1):
            try:
                raw = self._fetch_url_once(url, headers)
                self._store_cached_response(cache_key, raw)
                return raw
            except Exception as error:
                last_error = error
                if attempt >= self.settings.request_retry_count:
                    break
                sleep(min(0.25 * (attempt + 1), 0.75))

        raise RuntimeError(f"{self.source_name} request failed for {url}: {last_error}") from last_error

    def get_json(self, url: str, headers: Optional[Dict[str, str]] = None) -> Any:
        """Fetch JSON and raise a clear runtime error on failure."""

        raw = self.get_url(url, headers)
        try:
            return json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as error:
            raise RuntimeError(f"{self.source_name} failed to parse JSON from {url}: {error}") from error

    @staticmethod
    def parse_unix_timestamp(timestamp: int | float) -> datetime:
        """Convert a unix timestamp to UTC datetime."""

        return datetime.fromtimestamp(timestamp, tz=timezone.utc)

    @staticmethod
    def parse_iso_timestamp(timestamp: str) -> datetime:
        """Convert an ISO timestamp to UTC datetime."""

        normalized = timestamp.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)

    def log_fallback(self, error: Exception) -> None:
        """Log a source failure and continue with fallback data."""

        self.used_fallback = True
        LOGGER.warning("Falling back to sample data for %s: %s", self.source_name, error)

    def reset_fetch_state(self) -> None:
        """Clear per-fetch state before a new request cycle."""

        self.used_fallback = False
        self.raw_item_count = 0
        self.kept_item_count = 0

    def _fetch_url_once(self, url: str, headers: Optional[Dict[str, str]] = None) -> bytes:
        """Fetch raw bytes from a URL once without retry or cache logic."""

        try:
            import requests as _requests

            resp = _requests.get(
                url,
                headers=headers or {},
                timeout=self.settings.request_timeout_seconds,
            )
            resp.raise_for_status()
            return resp.content
        except ImportError:
            pass
        except Exception as error:
            raise RuntimeError(error) from error

        request = Request(url, headers=headers or {})
        try:
            with urlopen(request, timeout=self.settings.request_timeout_seconds) as response:
                return response.read()
        except (HTTPError, URLError, TimeoutError) as error:
            raise RuntimeError(error) from error

    def _cache_key(self, url: str, headers: Optional[Dict[str, str]]) -> tuple[str, str]:
        """Build a stable cache key from URL and headers."""

        normalized_headers = tuple(sorted((headers or {}).items()))
        return url, json.dumps(normalized_headers)

    def _read_cached_response(self, cache_key: tuple[str, str]) -> bytes | None:
        """Return a cached response when it is still fresh."""

        cached = _REQUEST_CACHE.get(cache_key)
        if cached is None:
            return None
        expires_at, payload = cached
        if datetime.now(tz=timezone.utc).timestamp() > expires_at:
            _REQUEST_CACHE.pop(cache_key, None)
            return None
        return payload

    def _store_cached_response(self, cache_key: tuple[str, str], payload: bytes) -> None:
        """Store a fetched response in the lightweight shared cache."""

        ttl_seconds = max(0, self.settings.source_cache_ttl_seconds)
        if ttl_seconds <= 0:
            return
        _REQUEST_CACHE[cache_key] = (
            datetime.now(tz=timezone.utc).timestamp() + ttl_seconds,
            payload,
        )
