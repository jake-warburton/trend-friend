"""Shared helpers for external market enrichment."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.config import Settings
from app.models import TrendMetricSnapshot


@dataclass(frozen=True)
class EnrichmentTarget:
    """Canonical trend input passed into market enrichers."""

    topic: str
    name: str
    aliases: list[str]


class MarketMetricEnricher(ABC):
    """Base class for enrichers that add platform-specific market metrics."""

    source_name: str

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @abstractmethod
    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        """Return market-footprint metrics for one target."""

    @staticmethod
    def utc_now() -> datetime:
        """Return a timezone-aware UTC timestamp."""

        return datetime.now(tz=timezone.utc)

    def get_json(self, url: str, headers: dict[str, str] | None = None) -> Any:
        """Fetch and decode JSON from an HTTP endpoint."""

        try:
            import requests as _requests

            response = _requests.get(url, headers=headers or {}, timeout=self.settings.request_timeout_seconds)
            response.raise_for_status()
            return response.json()
        except ImportError:
            pass

        request = Request(url, headers=headers or {})
        with urlopen(request, timeout=self.settings.request_timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))

    @staticmethod
    def build_query_url(base_url: str, params: dict[str, str]) -> str:
        """Return a URL with encoded query string parameters."""

        separator = "&" if "?" in base_url else "?"
        return f"{base_url}{separator}{urlencode(params)}"

    @staticmethod
    def compact_number(value: float) -> str:
        """Format a compact display number."""

        absolute = abs(value)
        if absolute >= 1_000_000_000:
            return f"{value / 1_000_000_000:.1f}B"
        if absolute >= 1_000_000:
            return f"{value / 1_000_000:.1f}M"
        if absolute >= 1_000:
            return f"{value / 1_000:.1f}K"
        if value.is_integer():
            return str(int(value))
        return f"{value:.1f}"

    @staticmethod
    def hashed_seed(value: str) -> int:
        """Return a stable integer seed for deterministic local fallbacks."""

        return sum((index + 1) * ord(character) for index, character in enumerate(value))
