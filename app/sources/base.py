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

    @abstractmethod
    def fetch(self) -> list[RawSourceItem]:
        """Return normalized items from the source."""

    def get_json(self, url: str, headers: Optional[Dict[str, str]] = None) -> Any:
        """Fetch JSON and raise a clear runtime error on failure."""

        request = Request(url, headers=headers or {})
        try:
            with urlopen(request, timeout=self.settings.request_timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            raise RuntimeError(f"{self.source_name} request failed for {url}: {error}") from error

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
