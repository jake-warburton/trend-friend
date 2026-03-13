"""Google News RSS source adapter for broad editorial topic coverage."""

from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

LOGGER = logging.getLogger(__name__)

_RSS_BASE = "https://news.google.com/rss/headlines/section/topic/{topic}?hl=en-US&gl=US&ceid=US:en"
_TOPICS = [
    ("WORLD", "world"),
    ("BUSINESS", "business"),
    ("TECHNOLOGY", "technology"),
    ("SCIENCE", "science"),
    ("HEALTH", "health"),
]


class GoogleNewsSourceAdapter(SourceAdapter):
    """Fetch broad editorial headlines from Google News topic RSS feeds."""

    source_name = "google_news"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_all_topics()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_items(self.sample_payload())

    def _fetch_all_topics(self) -> list[RawSourceItem]:
        items: list[RawSourceItem] = []
        per_topic_limit = max(self.settings.max_items_per_source // len(_TOPICS), 5)
        seen_titles: set[str] = set()
        for topic_code, section in _TOPICS:
            try:
                topic_items = self._fetch_rss(topic_code, section, per_topic_limit)
            except Exception as error:
                LOGGER.warning("Google News fetch failed for %s: %s", topic_code, error)
                continue
            for item in topic_items:
                normalized_title = item.title.strip().lower()
                if normalized_title in seen_titles:
                    continue
                seen_titles.add(normalized_title)
                items.append(item)
        return items[: self.settings.max_items_per_source]

    def _fetch_rss(self, topic_code: str, section: str, limit: int) -> list[RawSourceItem]:
        xml_bytes = self.get_url(
            _RSS_BASE.format(topic=topic_code),
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; TrendFriend/1.0)",
                "Accept": "application/rss+xml, application/xml, text/xml",
            },
        )
        return self._parse_rss(xml_bytes, section=section, limit=limit)

    def _parse_rss(self, xml_bytes: bytes, section: str, limit: int) -> list[RawSourceItem]:
        root = ET.fromstring(xml_bytes)
        items: list[RawSourceItem] = []
        for item in root.iter("item"):
            title = self._clean_title((item.findtext("title") or "").strip())
            if not title:
                continue
            link = (item.findtext("link") or "").strip()
            pub_date = item.findtext("pubDate") or ""
            source_label = (item.findtext("source") or "").strip()
            timestamp = self._parse_pub_date(pub_date)
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=f"gn-{section}-{hash(title) & 0xFFFFFFFF:08x}",
                    title=title,
                    url=link,
                    timestamp=timestamp,
                    engagement_score=max(float(limit - len(items)), 1.0),
                    metadata={
                        "section": section,
                        "publisher": source_label,
                    },
                )
            )
            if len(items) >= limit:
                break
        self.raw_item_count += len(items)
        self.kept_item_count += len(items)
        return items

    def _normalize_items(self, payload: list[dict[str, object]]) -> list[RawSourceItem]:
        now = datetime.now(tz=timezone.utc)
        items: list[RawSourceItem] = []
        for index, entry in enumerate(payload[: self.settings.max_items_per_source], start=1):
            title = self._clean_title(str(entry.get("title", "")).strip())
            if not title:
                continue
            section = str(entry.get("section", "world")).strip().lower() or "world"
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=str(entry.get("id", f"gn-sample-{index}")),
                    title=title,
                    url=str(entry.get("url", "")),
                    timestamp=now,
                    engagement_score=float(entry.get("rank", max(1, len(payload) - index))),
                    metadata={
                        "section": section,
                        "publisher": str(entry.get("publisher", "")),
                    },
                )
            )
        self.raw_item_count = len(items)
        self.kept_item_count = len(items)
        return items

    @staticmethod
    def _parse_pub_date(date_str: str) -> datetime:
        if not date_str:
            return datetime.now(tz=timezone.utc)
        try:
            from email.utils import parsedate_to_datetime

            return parsedate_to_datetime(date_str).astimezone(timezone.utc)
        except (TypeError, ValueError):
            return datetime.now(tz=timezone.utc)

    @staticmethod
    def _clean_title(title: str) -> str:
        if " - " not in title:
            return title
        headline, publisher = title.rsplit(" - ", maxsplit=1)
        if headline and 2 <= len(publisher) <= 40:
            return headline.strip()
        return title

    @staticmethod
    def sample_payload() -> list[dict[str, object]]:
        return [
            {
                "id": "gn-1",
                "title": "Ceasefire talks intensify as shipping risks rise in the Red Sea",
                "url": "https://news.google.com/articles/example-1",
                "section": "world",
                "publisher": "Reuters",
                "rank": 9,
            },
            {
                "id": "gn-2",
                "title": "Fed rate cut bets climb after softer US inflation data",
                "url": "https://news.google.com/articles/example-2",
                "section": "business",
                "publisher": "Bloomberg",
                "rank": 8,
            },
            {
                "id": "gn-3",
                "title": "Premier League title race tightens after late winner",
                "url": "https://news.google.com/articles/example-3",
                "section": "sports",
                "publisher": "ESPN",
                "rank": 7,
            },
        ]
