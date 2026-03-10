"""Twitter/X source adapter using the v2 search API."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

LOGGER = logging.getLogger(__name__)

TECH_QUERY = "(AI OR machine learning OR startup OR open source OR robotics) lang:en -is:retweet"


class TwitterSourceAdapter(SourceAdapter):
    """Fetch recent tech-related tweets and normalize them."""

    source_name = "twitter"

    def fetch(self) -> list[RawSourceItem]:
        if not self.settings.twitter_bearer_token:
            self.log_fallback(RuntimeError("TWITTER_BEARER_TOKEN not set"))
            return self._normalize_search(self.sample_payload())
        try:
            return self._fetch_recent_search()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_search(self.sample_payload())

    def _fetch_recent_search(self) -> list[RawSourceItem]:
        """Fetch recent tweets matching tech keywords via v2 search."""

        url = (
            "https://api.twitter.com/2/tweets/search/recent"
            f"?query={TECH_QUERY}"
            f"&max_results={min(self.settings.max_items_per_source, 100)}"
            "&tweet.fields=created_at,public_metrics,author_id"
        )
        payload = self.get_json(
            url,
            headers={"Authorization": f"Bearer {self.settings.twitter_bearer_token}"},
        )
        return self._normalize_search(payload)

    def _normalize_search(self, payload: dict[str, object]) -> list[RawSourceItem]:
        """Normalize Twitter v2 search response into shared models."""

        tweets = payload.get("data", [])
        items: list[RawSourceItem] = []
        for tweet in tweets[: self.settings.max_items_per_source]:
            tweet_id = str(tweet.get("id", ""))
            text = str(tweet.get("text", "")).strip()
            if not text or not tweet_id:
                continue

            metrics = tweet.get("public_metrics", {})
            engagement = (
                float(metrics.get("like_count", 0))
                + float(metrics.get("retweet_count", 0)) * 2
                + float(metrics.get("reply_count", 0))
            )

            created_at_str = str(tweet.get("created_at", ""))
            if created_at_str:
                try:
                    timestamp = self.parse_iso_timestamp(created_at_str)
                except (ValueError, TypeError):
                    timestamp = datetime.now(tz=timezone.utc)
            else:
                timestamp = datetime.now(tz=timezone.utc)

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=tweet_id,
                    title=text,
                    url=f"https://x.com/i/status/{tweet_id}",
                    timestamp=timestamp,
                    engagement_score=engagement,
                    metadata={"author_id": str(tweet.get("author_id", ""))},
                )
            )
        return items

    @staticmethod
    def sample_payload() -> dict[str, object]:
        """Return deterministic sample data for local fallback runs."""

        return {
            "data": [
                {
                    "id": "tw-1",
                    "text": "AI agents are transforming enterprise automation workflows at scale",
                    "created_at": "2026-03-09T12:00:00Z",
                    "author_id": "100001",
                    "public_metrics": {
                        "like_count": 1200,
                        "retweet_count": 450,
                        "reply_count": 85,
                    },
                },
                {
                    "id": "tw-2",
                    "text": "Open source robotics framework reaches 10k stars on GitHub",
                    "created_at": "2026-03-09T14:30:00Z",
                    "author_id": "100002",
                    "public_metrics": {
                        "like_count": 800,
                        "retweet_count": 220,
                        "reply_count": 42,
                    },
                },
                {
                    "id": "tw-3",
                    "text": "New machine learning technique reduces training costs by 60%",
                    "created_at": "2026-03-09T16:00:00Z",
                    "author_id": "100003",
                    "public_metrics": {
                        "like_count": 650,
                        "retweet_count": 180,
                        "reply_count": 38,
                    },
                },
            ]
        }
