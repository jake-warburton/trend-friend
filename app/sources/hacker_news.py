"""Hacker News source adapter."""

from __future__ import annotations

from typing import Optional

from app.models import RawSourceItem
from app.sources.base import SourceAdapter


class HackerNewsSourceAdapter(SourceAdapter):
    """Fetch top Hacker News stories and normalize them."""

    source_name = "hacker_news"

    def fetch(self) -> list[RawSourceItem]:
        try:
            story_ids = self.get_json("https://hacker-news.firebaseio.com/v0/topstories.json")
            items: list[RawSourceItem] = []
            seen_ids: set[str] = set()
            stories_per_page = self._stories_per_page()
            max_story_ids = min(
                len(story_ids),
                stories_per_page * max(1, self.settings.hacker_news_page_limit),
            )
            for story_id in story_ids[:max_story_ids]:
                payload = self.get_json(
                    f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json"
                )
                normalized = self.normalize_item(payload)
                if normalized is not None and normalized.external_id not in seen_ids:
                    seen_ids.add(normalized.external_id)
                    items.append(normalized)
                if len(items) >= self.settings.max_items_per_source:
                    break
            return items
        except Exception as error:
            self.log_fallback(error)
            return [item for item in (self.normalize_item(data) for data in self.sample_payload()) if item]

    def _stories_per_page(self) -> int:
        """Return the conceptual HN page size used to bound depth."""

        return max(1, min(self.settings.max_items_per_source, 30))

    def normalize_item(self, payload: dict[str, object]) -> Optional[RawSourceItem]:
        """Normalize a single Hacker News item payload."""

        title = str(payload.get("title", "")).strip()
        timestamp = int(payload.get("time", 0))
        if not title or not timestamp:
            return None
        return RawSourceItem(
            source=self.source_name,
            external_id=str(payload.get("id", "")),
            title=title,
            url=str(payload.get("url", f"https://news.ycombinator.com/item?id={payload.get('id', '')}")),
            timestamp=self.parse_unix_timestamp(timestamp),
            engagement_score=float(payload.get("score", 0)) + float(payload.get("descendants", 0)),
            metadata={"by": str(payload.get("by", ""))},
        )

    @staticmethod
    def sample_payload() -> list[dict[str, object]]:
        """Return deterministic fallback items."""

        return [
            {
                "id": 1001,
                "title": "AI coding agents reshape internal developer tooling",
                "time": 1_709_202_200,
                "score": 520,
                "descendants": 240,
                "url": "https://example.com/ai-coding-agents",
                "by": "hn-user",
            },
            {
                "id": 1002,
                "title": "Battery recycling startups reach new manufacturing milestone",
                "time": 1_709_205_000,
                "score": 310,
                "descendants": 110,
                "url": "https://example.com/battery-recycling",
                "by": "hn-user-2",
            },
        ]
