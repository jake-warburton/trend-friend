"""Chrome Web Store adapter for browser-tool and distribution signals."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from html import unescape
from urllib.parse import quote_plus

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

QUERY_FAMILIES = (
    ("ai", "ai productivity"),
    ("agents", "ai agents"),
    ("search", "search assistant"),
    ("builder", "developer tools ai"),
)

CARD_PATTERN = re.compile(
    r'data-item-id="(?P<id>[a-z]{32})".*?href="\./detail/(?P<slug>[^"/]+)/(?P=id)".*?<h2 class="CiI2if">(?P<title>.*?)</h2>'
    r'.*?Average rating (?P<rating>[0-9.]+) out of 5 stars\..*?id="i9"[^>]*>(?P<description>.*?)<',
    re.DOTALL,
)


class ChromeWebStoreSourceAdapter(SourceAdapter):
    """Fetch Chrome extension results for a few trend-rich query families."""

    source_name = "chrome_web_store"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_search()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_search(self) -> list[RawSourceItem]:
        per_query_limit = max(4, min(self.settings.max_items_per_source // len(QUERY_FAMILIES), 8))
        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; SignalEye/1.0)",
            "Accept": "text/html,application/xhtml+xml",
        }
        for query_family, query in QUERY_FAMILIES:
            html = self.get_url(
                f"https://chromewebstore.google.com/search/{quote_plus(query)}",
                headers=headers,
            ).decode("utf-8", errors="ignore")
            normalized_items = self._parse_search_page(html, query_family=query_family)
            self.raw_item_count += len(normalized_items)
            for item in normalized_items[:per_query_limit]:
                if item.external_id in seen_ids:
                    continue
                seen_ids.add(item.external_id)
                items.append(item)
                self.kept_item_count += 1
                if len(items) >= self.settings.max_items_per_source:
                    return items
        return items

    def _parse_search_page(self, html: str, query_family: str) -> list[RawSourceItem]:
        items: list[RawSourceItem] = []
        now = datetime.now(tz=timezone.utc)
        for position, match in enumerate(CARD_PATTERN.finditer(html)):
            extension_id = match.group("id")
            slug = match.group("slug")
            title = self._clean_text(match.group("title"))
            description = self._clean_text(match.group("description"))
            if not extension_id or not title:
                continue
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=extension_id,
                    title=f"{title} {description}".strip(),
                    url=f"https://chromewebstore.google.com/detail/{slug}/{extension_id}",
                    timestamp=now,
                    engagement_score=self._engagement_score(position, match.group("rating")),
                    metadata={"query_family": query_family, "store": "chrome"},
                )
            )
        return items

    def _engagement_score(self, position: int, rating: str) -> float:
        try:
            rating_value = float(rating)
        except ValueError:
            rating_value = 0.0
        return round(max(35.0, 130.0 - (position * 8.0)) + (rating_value * 12.0), 2)

    def _clean_text(self, value: str) -> str:
        text = unescape(value)
        text = re.sub(r"<[^>]+>", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    def _fallback_items(self) -> list[RawSourceItem]:
        now = datetime.now(tz=timezone.utc)
        return [
            RawSourceItem(
                source=self.source_name,
                external_id="ofpnmcalabcbjgholdjcjblkibolbppb",
                title="Monica all in one AI assistant for writing, search, and browser workflows",
                url="https://chromewebstore.google.com/detail/monica-all-in-one-ai-assi/ofpnmcalabcbjgholdjcjblkibolbppb",
                timestamp=now,
                engagement_score=176.0,
                metadata={"query_family": "ai", "store": "chrome"},
            ),
            RawSourceItem(
                source=self.source_name,
                external_id="chrome-ai-agents-demo-source-1",
                title="AI agent sidebar for research and browser task automation",
                url="https://chromewebstore.google.com/search/ai%20agents",
                timestamp=now,
                engagement_score=154.0,
                metadata={"query_family": "agents", "store": "chrome"},
            ),
        ]
