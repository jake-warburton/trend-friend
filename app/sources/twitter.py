"""Twitter/X source adapter — reads pre-scraped tweets from the database."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

LOGGER = logging.getLogger(__name__)


class TwitterSourceAdapter(SourceAdapter):
    """Read tweets from the twitter_tweets table populated by the scraper loop."""

    source_name = "twitter"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_from_database()
        except Exception as error:
            self.log_fallback(error)
            return self._normalize_sample(self.sample_payload())

    def _fetch_from_database(self) -> list[RawSourceItem]:
        """Read stored tweets from the database."""
        from app.data.primary import connect_primary_database
        from app.data.repositories import TwitterTweetRepository

        connection = connect_primary_database(self.settings)
        repo = TwitterTweetRepository(connection)
        tweets = repo.fetch_all_tweets()
        connection.close()

        items: list[RawSourceItem] = []
        for tweet in tweets[: self.settings.max_items_per_source]:
            metadata = json.loads(tweet["metadata"]) if isinstance(tweet["metadata"], str) else (tweet["metadata"] or {})
            ts_str = tweet["timestamp"]
            try:
                timestamp = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if isinstance(ts_str, str) else ts_str
            except (ValueError, TypeError):
                timestamp = datetime.now(tz=timezone.utc)

            items.append(RawSourceItem(
                source=self.source_name,
                external_id=tweet["tweet_id"],
                title=tweet["text"],
                url=f"https://x.com/i/status/{tweet['tweet_id']}",
                timestamp=timestamp,
                engagement_score=tweet["engagement"],
                metadata=metadata,
            ))
            self.raw_item_count += 1
            self.kept_item_count += 1

        return items

    @staticmethod
    def _normalize_sample(payload: dict[str, object]) -> list[RawSourceItem]:
        """Normalize sample data for fallback."""
        items: list[RawSourceItem] = []
        for tweet in payload.get("data", []):
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
            items.append(RawSourceItem(
                source="twitter",
                external_id=tweet_id,
                title=text,
                url=f"https://x.com/i/status/{tweet_id}",
                timestamp=datetime.now(tz=timezone.utc),
                engagement_score=engagement,
                metadata={"author_id": str(tweet.get("author_id", ""))},
            ))
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
                    "public_metrics": {"like_count": 1200, "retweet_count": 450, "reply_count": 85},
                },
                {
                    "id": "tw-2",
                    "text": "Open source robotics framework reaches 10k stars on GitHub",
                    "created_at": "2026-03-09T14:30:00Z",
                    "author_id": "100002",
                    "public_metrics": {"like_count": 800, "retweet_count": 220, "reply_count": 42},
                },
                {
                    "id": "tw-3",
                    "text": "New machine learning technique reduces training costs by 60%",
                    "created_at": "2026-03-09T16:00:00Z",
                    "author_id": "100003",
                    "public_metrics": {"like_count": 650, "retweet_count": 180, "reply_count": 38},
                },
            ]
        }
