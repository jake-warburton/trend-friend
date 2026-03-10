"""Reddit source adapter using the public JSON listing API."""

from __future__ import annotations

from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter


class RedditSourceAdapter(SourceAdapter):
    """Fetch hot Reddit posts via RSS and normalize them."""

    source_name = "reddit"
    TREND_SUBREDDITS = [
        "technology",
        "programming",
        "MachineLearning",
        "opensource",
        "startups",
    ]

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_listing()
        except Exception as error:
            self.log_fallback(error)
            return self.normalize_items(self.sample_payload())

    def _fetch_listing(self) -> list[RawSourceItem]:
        """Fetch multiple bounded listing pages from Reddit's public JSON endpoint."""

        subreddit_path = "+".join(self.TREND_SUBREDDITS)
        url = f"https://www.reddit.com/r/{subreddit_path}/hot.json?raw_json=1&limit=100"
        headers = {
            "User-Agent": self.settings.reddit_user_agent,
            "Accept": "application/json",
        }
        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()
        after: str | None = None
        seen_after_tokens: set[str] = set()

        for _ in range(max(1, self.settings.reddit_page_limit)):
            page_url = url if after is None else f"{url}&after={after}"
            payload = self.get_json(page_url, headers=headers)
            page_items = self.normalize_items(payload, limit=self.settings.max_items_per_source)
            for item in page_items:
                if item.external_id in seen_ids:
                    continue
                seen_ids.add(item.external_id)
                items.append(item)
                if len(items) >= self.settings.max_items_per_source:
                    return items
            after_value = payload.get("data", {}).get("after")
            after = str(after_value).strip() if after_value else None
            if not after or after in seen_after_tokens:
                break
            seen_after_tokens.add(after)

        return items

    @staticmethod
    def _parse_updated(date_str: str) -> datetime:
        """Parse an Atom updated timestamp."""
        if not date_str:
            return datetime.now(tz=timezone.utc)
        try:
            normalized = date_str.replace("Z", "+00:00")
            return datetime.fromisoformat(normalized)
        except (ValueError, TypeError):
            return datetime.now(tz=timezone.utc)

    def normalize_items(self, payload: dict[str, object], limit: int | None = None) -> list[RawSourceItem]:
        """Normalize Reddit listing payload into shared models (used for fallback sample data)."""

        children = payload.get("data", {}).get("children", [])
        items: list[RawSourceItem] = []
        max_items = self.settings.max_items_per_source if limit is None else limit
        for child in children[:max_items]:
            post = child.get("data", {})
            title = str(post.get("title", "")).strip()
            permalink = str(post.get("permalink", ""))
            created_utc = float(post.get("created_utc", 0.0))
            if not title or not created_utc:
                continue
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=str(post.get("id", "")),
                    title=title,
                    url=f"https://www.reddit.com{permalink}",
                    timestamp=self.parse_unix_timestamp(created_utc),
                    engagement_score=float(post.get("score", 0)) + float(post.get("num_comments", 0)),
                    metadata={"subreddit": str(post.get("subreddit", ""))},
                )
            )
        return items

    @staticmethod
    def sample_payload() -> dict[str, object]:
        """Return deterministic sample data for local fallback runs."""

        return {
            "data": {
                "children": [
                    {
                        "data": {
                            "id": "r1",
                            "title": "AI agents are replacing repetitive office workflows",
                            "permalink": "/r/technology/comments/r1",
                            "created_utc": 1_709_200_000,
                            "score": 4200,
                            "num_comments": 680,
                            "subreddit": "technology",
                        }
                    },
                    {
                        "data": {
                            "id": "r2",
                            "title": "Open source robotics tools gain momentum in startups",
                            "permalink": "/r/startups/comments/r2",
                            "created_utc": 1_709_203_600,
                            "score": 2800,
                            "num_comments": 220,
                            "subreddit": "startups",
                        }
                    },
                ]
            }
        }
