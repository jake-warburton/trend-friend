"""Shared source adapter helpers."""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import Settings
from app.models import RawSourceItem

LOGGER = logging.getLogger(__name__)


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
            raise RuntimeError(f"{self.source_name} request failed for {url}: {error}") from error

        request = Request(url, headers=headers or {})
        try:
            with urlopen(request, timeout=self.settings.request_timeout_seconds) as response:
                return response.read()
        except (HTTPError, URLError, TimeoutError) as error:
            raise RuntimeError(f"{self.source_name} request failed for {url}: {error}") from error

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
