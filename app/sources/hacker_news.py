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
            for story_id in story_ids[: self.settings.max_items_per_source]:
                payload = self.get_json(
                    f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json"
                )
                normalized = self.normalize_item(payload)
                if normalized is not None:
                    items.append(normalized)
            return items
        except Exception as error:
            self.log_fallback(error)
            return [item for item in (self.normalize_item(data) for data in self.sample_payload()) if item]

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
