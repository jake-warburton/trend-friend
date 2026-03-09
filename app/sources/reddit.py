"""Reddit source adapter."""

from __future__ import annotations

from app.models import RawSourceItem
from app.sources.base import SourceAdapter


class RedditSourceAdapter(SourceAdapter):
    """Fetch hot Reddit posts and normalize them."""

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
            subreddit_path = "+".join(self.TREND_SUBREDDITS)
            payload = self.get_json(
                f"https://www.reddit.com/r/{subreddit_path}/hot.json?limit={self.settings.max_items_per_source}",
                headers={"User-Agent": self.settings.reddit_user_agent},
            )
            return self.normalize_items(payload)
        except Exception as error:
            self.log_fallback(error)
            return self.normalize_items(self.sample_payload())

    def normalize_items(self, payload: dict[str, object]) -> list[RawSourceItem]:
        """Normalize Reddit listing payload into shared models."""

        children = payload.get("data", {}).get("children", [])
        items: list[RawSourceItem] = []
        for child in children[: self.settings.max_items_per_source]:
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
