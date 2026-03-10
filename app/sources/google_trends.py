"""Google Trends source adapter using the public trending RSS feed."""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

LOGGER = logging.getLogger(__name__)

_RSS_BASE = "https://trends.google.com/trending/rss?geo={geo}"
_REGIONS = [
    ("US", "United States", "US"),
    ("GB", "United Kingdom", "GB"),
    ("DE", "Germany", "DE"),
    ("IN", "India", "IN"),
]


class GoogleTrendsSourceAdapter(SourceAdapter):
    """Fetch trending searches from Google Trends RSS and normalize them."""

    source_name = "google_trends"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_all_regions()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_trending(self.sample_payload())

    def _fetch_all_regions(self) -> list[RawSourceItem]:
        """Fetch trending searches from multiple regions."""

        all_items: list[RawSourceItem] = []
        per_region = max(self.settings.max_items_per_source // len(_REGIONS), 5)
        for geo_code, _label, country_code in _REGIONS:
            try:
                items = self._fetch_rss(geo_code, country_code, per_region)
                all_items.extend(items)
            except Exception as exc:
                LOGGER.warning("Google Trends fetch failed for %s: %s", geo_code, exc)
        return all_items[: self.settings.max_items_per_source]

    def _fetch_rss(self, geo: str, country_code: str, limit: int) -> list[RawSourceItem]:
        """Fetch and parse the Google Trends daily trending RSS feed for one region."""

        url = _RSS_BASE.format(geo=geo)
        xml_bytes = self.get_url(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; TrendFriend/1.0)",
            "Accept": "application/rss+xml, application/xml, text/xml",
        })
        return self._parse_rss(xml_bytes, geo, country_code, limit)

    def _parse_rss(
        self, xml_bytes: bytes, geo: str = "US", country_code: str = "US", limit: int = 30,
    ) -> list[RawSourceItem]:
        """Parse RSS XML into normalized items."""

        root = ET.fromstring(xml_bytes)

        # The feed uses the ht namespace for traffic/picture data
        ns = {"ht": "https://trends.google.com/trending/rss"}

        items: list[RawSourceItem] = []
        for item in root.iter("item"):
            title = (item.findtext("title") or "").strip()
            if not title:
                continue

            link = (item.findtext("link") or "").strip()
            pub_date = item.findtext("pubDate") or ""
            traffic_text = item.findtext("ht:approx_traffic", namespaces=ns) or "0"

            timestamp = self._parse_pub_date(pub_date)
            traffic = self._parse_traffic(traffic_text)

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=f"gt-{geo.lower()}-{hash(title) & 0xFFFFFFFF:08x}",
                    title=title,
                    url=link or f"https://trends.google.com/trending?geo={geo}&q={title.replace(' ', '+')}",
                    timestamp=timestamp,
                    engagement_score=traffic,
                    metadata={"region": geo},
                    geo_country_code=country_code,
                    geo_region=None,
                    geo_detection_mode="explicit",
                    geo_confidence=0.95,
                )
            )

            if len(items) >= limit:
                break

        return items

    @staticmethod
    def _parse_pub_date(date_str: str) -> datetime:
        """Parse an RSS pubDate string, falling back to now on failure."""
        if not date_str:
            return datetime.now(tz=timezone.utc)
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(date_str).astimezone(timezone.utc)
        except (ValueError, TypeError):
            return datetime.now(tz=timezone.utc)

    @staticmethod
    def _parse_traffic(traffic_text: str) -> float:
        """Parse traffic strings like '500,000+' into a float."""
        cleaned = traffic_text.replace(",", "").replace("+", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

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
