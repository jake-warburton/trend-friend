"""Curated RSS adapter for stable AI and builder-news corroboration."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}


@dataclass(frozen=True)
class FeedSpec:
    """One curated public feed to sample for additional corroboration."""

    label: str
    publisher: str
    url: str
    kind: str = "rss"


FEEDS: tuple[FeedSpec, ...] = (
    FeedSpec("TechCrunch AI", "TechCrunch", "https://techcrunch.com/category/artificial-intelligence/feed/"),
    FeedSpec("The Verge AI", "The Verge", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
    FeedSpec("OpenAI News", "OpenAI", "https://openai.com/news/rss.xml"),
    FeedSpec("Google AI Blog", "Google", "https://blog.google/technology/ai/rss/"),
    FeedSpec("MarkTechPost", "MarkTechPost", "https://www.marktechpost.com/feed/"),
    FeedSpec("AI News", "AI News", "https://www.artificialintelligence-news.com/feed/"),
)


class CuratedRssSourceAdapter(SourceAdapter):
    """Fetch a curated bundle of stable public feeds as one corroboration source."""

    source_name = "curated_feeds"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_feeds()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_feeds(self) -> list[RawSourceItem]:
        per_feed_limit = max(3, min(self.settings.max_items_per_source // len(FEEDS), 8))
        items: list[RawSourceItem] = []
        seen_titles: set[str] = set()
        headers = {
            "User-Agent": self.settings.reddit_user_agent,
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml",
        }
        for feed in FEEDS:
            raw = self.get_url(feed.url, headers=headers)
            feed_items = self._parse_feed(raw, feed=feed, limit=per_feed_limit)
            self.raw_item_count += len(feed_items)
            for item in feed_items:
                normalized_title = item.title.lower()
                if normalized_title in seen_titles:
                    continue
                seen_titles.add(normalized_title)
                items.append(item)
                self.kept_item_count += 1
                if len(items) >= self.settings.max_items_per_source:
                    return items
        return items

    def _parse_feed(self, payload: bytes, feed: FeedSpec, limit: int) -> list[RawSourceItem]:
        root = ET.fromstring(payload)
        entries = root.findall("./channel/item")
        if entries:
            return self._parse_rss_entries(entries, feed=feed, limit=limit)
        atom_entries = root.findall("atom:entry", ATOM_NS)
        if atom_entries:
            return self._parse_atom_entries(atom_entries, feed=feed, limit=limit)
        return []

    def _parse_rss_entries(self, entries: list[ET.Element], feed: FeedSpec, limit: int) -> list[RawSourceItem]:
        items: list[RawSourceItem] = []
        for position, entry in enumerate(entries[:limit]):
            title = self._clean_title((entry.findtext("title") or "").strip(), feed.publisher)
            link = (entry.findtext("link") or "").strip()
            pub_date = (entry.findtext("pubDate") or "").strip()
            description = self._strip_html((entry.findtext("description") or "").strip())
            if not title or not link:
                continue
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=f"{feed.publisher.lower().replace(' ', '-')}-{hash(link) & 0xFFFFFFFF:08x}",
                    title=f"{title} {description[:140]}".strip(),
                    url=link,
                    timestamp=self._parse_timestamp(pub_date),
                    engagement_score=self._score_position(position, feed.publisher),
                    metadata={"feed": feed.label, "publisher": feed.publisher},
                )
            )
        return items

    def _parse_atom_entries(self, entries: list[ET.Element], feed: FeedSpec, limit: int) -> list[RawSourceItem]:
        items: list[RawSourceItem] = []
        for position, entry in enumerate(entries[:limit]):
            title = self._clean_title((entry.findtext("atom:title", "", ATOM_NS) or "").strip(), feed.publisher)
            updated = (entry.findtext("atom:updated", "", ATOM_NS) or entry.findtext("atom:published", "", ATOM_NS) or "").strip()
            summary = self._strip_html(
                (entry.findtext("atom:summary", "", ATOM_NS) or entry.findtext("atom:content", "", ATOM_NS) or "").strip()
            )
            link = ""
            for link_el in entry.findall("atom:link", ATOM_NS):
                href = (link_el.get("href") or "").strip()
                rel = (link_el.get("rel") or "alternate").strip()
                if href and rel == "alternate":
                    link = href
                    break
            if not title or not link:
                continue
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=f"{feed.publisher.lower().replace(' ', '-')}-{hash(link) & 0xFFFFFFFF:08x}",
                    title=f"{title} {summary[:140]}".strip(),
                    url=link,
                    timestamp=self._parse_timestamp(updated),
                    engagement_score=self._score_position(position, feed.publisher),
                    metadata={"feed": feed.label, "publisher": feed.publisher},
                )
            )
        return items

    def _score_position(self, position: int, publisher: str) -> float:
        publisher_bonus = {
            "OpenAI": 28.0,
            "Google": 24.0,
            "TechCrunch": 20.0,
            "The Verge": 18.0,
        }.get(publisher, 14.0)
        return max(42.0, 120.0 - (position * 6.0) + publisher_bonus)

    def _parse_timestamp(self, value: str) -> datetime:
        if not value:
            return datetime.now(tz=timezone.utc)
        try:
            return self.parse_iso_timestamp(value)
        except ValueError:
            try:
                from email.utils import parsedate_to_datetime

                return parsedate_to_datetime(value).astimezone(timezone.utc)
            except (TypeError, ValueError):
                return datetime.now(tz=timezone.utc)

    def _clean_title(self, title: str, publisher: str) -> str:
        if not title:
            return ""
        cleaned = re.sub(r"\s+", " ", title).strip()
        suffix = f" - {publisher}"
        if cleaned.endswith(suffix):
            cleaned = cleaned[: -len(suffix)].strip()
        return cleaned

    def _strip_html(self, value: str) -> str:
        if not value:
            return ""
        text = re.sub(r"<[^>]+>", " ", value)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _fallback_items(self) -> list[RawSourceItem]:
        now = datetime.now(tz=timezone.utc)
        return [
            RawSourceItem(
                source=self.source_name,
                external_id="curated-1",
                title="OpenAI launches new agent tooling for production builders",
                url="https://openai.com/news/",
                timestamp=now,
                engagement_score=142.0,
                metadata={"feed": "OpenAI News", "publisher": "OpenAI"},
            ),
            RawSourceItem(
                source=self.source_name,
                external_id="curated-2",
                title="TechCrunch tracks rising demand for AI coding assistants in startups",
                url="https://techcrunch.com/category/artificial-intelligence/",
                timestamp=now,
                engagement_score=128.0,
                metadata={"feed": "TechCrunch AI", "publisher": "TechCrunch"},
            ),
        ]
