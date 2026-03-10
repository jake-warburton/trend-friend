"""Google Trends source adapter using pytrends."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

LOGGER = logging.getLogger(__name__)

TREND_CATEGORIES = {
    "t": 0,  # All categories
}

GEO = ""  # Worldwide


class GoogleTrendsSourceAdapter(SourceAdapter):
    """Fetch trending searches from Google Trends and normalize them."""

    source_name = "google_trends"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_trending_searches()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_trending(self.sample_payload())

    def _fetch_trending_searches(self) -> list[RawSourceItem]:
        """Fetch daily trending searches via pytrends."""

        try:
            from pytrends.request import TrendReq
        except ImportError as error:
            raise RuntimeError(
                "pytrends is required for Google Trends. Install with: pip install pytrends"
            ) from error

        pytrends = TrendReq(hl="en-US", tz=360, timeout=(10, 25))
        trending_df = pytrends.trending_searches(pn="united_states")
        return self._normalize_trending_df(trending_df)

    def _normalize_trending_df(self, trending_df: object) -> list[RawSourceItem]:
        """Normalize a pandas DataFrame of trending searches into shared models."""

        items: list[RawSourceItem] = []
        now = datetime.now(tz=timezone.utc)
        try:
            rows = list(trending_df.itertuples())
        except AttributeError:
            return items

        for index, row in enumerate(rows[: self.settings.max_items_per_source]):
            title = str(row[1]).strip() if len(row) > 1 else ""
            if not title:
                continue
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=f"gt-trending-{index}",
                    title=title,
                    url=f"https://trends.google.com/trending?geo=US&q={title.replace(' ', '+')}",
                    timestamp=now,
                    engagement_score=float(self.settings.max_items_per_source - index),
                    metadata={"region": "US"},
                )
            )
        return items

    def _normalize_trending(self, payload: list[dict[str, object]]) -> list[RawSourceItem]:
        """Normalize a list of sample trending search entries."""

        items: list[RawSourceItem] = []
        now = datetime.now(tz=timezone.utc)
        for entry in payload[: self.settings.max_items_per_source]:
            title = str(entry.get("title", "")).strip()
            if not title:
                continue
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=str(entry.get("id", "")),
                    title=title,
                    url=str(entry.get("url", "")),
                    timestamp=now,
                    engagement_score=float(entry.get("traffic", 0)),
                    metadata={"region": str(entry.get("region", "US"))},
                )
            )
        return items

    @staticmethod
    def sample_payload() -> list[dict[str, object]]:
        """Return deterministic sample data for local fallback runs."""

        return [
            {
                "id": "gt-1",
                "title": "AI agents enterprise automation",
                "url": "https://trends.google.com/trending?geo=US&q=AI+agents",
                "traffic": 500000,
                "region": "US",
            },
            {
                "id": "gt-2",
                "title": "Quantum computing breakthrough",
                "url": "https://trends.google.com/trending?geo=US&q=Quantum+computing",
                "traffic": 200000,
                "region": "US",
            },
            {
                "id": "gt-3",
                "title": "Robotics manufacturing startup",
                "url": "https://trends.google.com/trending?geo=US&q=Robotics+manufacturing",
                "traffic": 150000,
                "region": "US",
            },
        ]
