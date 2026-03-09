"""Wikipedia source adapter."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter


class WikipediaSourceAdapter(SourceAdapter):
    """Fetch popular Wikipedia pages and normalize them."""

    source_name = "wikipedia"
    SKIPPED_ARTICLE_PREFIXES = ("Special:", "File:", "Portal:", "Template:", "Wikipedia:", "Category:")

    def fetch(self) -> list[RawSourceItem]:
        try:
            target_date = (datetime.now(tz=timezone.utc) - timedelta(days=1)).strftime("%Y/%m/%d")
            payload = self.get_json(
                f"https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/{target_date}",
                headers={
                    "User-Agent": self.settings.reddit_user_agent,
                    "Api-User-Agent": self.settings.reddit_user_agent,
                },
            )
            return self.normalize_items(payload)
        except Exception as error:
            self.log_fallback(error)
            return self.normalize_items(self.sample_payload())

    def normalize_items(self, payload: dict[str, object]) -> list[RawSourceItem]:
        """Normalize top pageview payload into shared models."""

        items_payload = payload.get("items", [])
        if not items_payload:
            return []
        first_day = items_payload[0]
        articles = first_day.get("articles", [])
        timestamp = self.parse_day_timestamp(first_day)
        items: list[RawSourceItem] = []
        for article in articles[: self.settings.max_items_per_source]:
            article_name = str(article.get("article", "")).replace("_", " ").strip()
            views = int(article.get("views", 0))
            if not article_name or article_name == "Main Page":
                continue
            if article_name.startswith(self.SKIPPED_ARTICLE_PREFIXES):
                continue
            if not article_name[0].isalnum():
                continue
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=article_name,
                    title=article_name,
                    url=f"https://en.wikipedia.org/wiki/{article_name.replace(' ', '_')}",
                    timestamp=timestamp,
                    engagement_score=float(views),
                    metadata={"rank": str(article.get("rank", ""))},
                )
            )
        return items

    @staticmethod
    def parse_day_timestamp(payload: dict[str, object]) -> datetime:
        """Build a UTC timestamp from the Wikimedia day payload."""

        year = int(payload.get("year", 1970))
        month = int(payload.get("month", 1))
        day = int(payload.get("day", 1))
        return datetime(year, month, day, tzinfo=timezone.utc)

    @staticmethod
    def sample_payload() -> dict[str, object]:
        """Return deterministic fallback pageviews."""

        return {
            "items": [
                {
                    "articles": [
                        {"article": "Artificial_intelligence", "views": 982000, "rank": 1},
                        {"article": "Battery_recycling", "views": 221000, "rank": 2},
                        {"article": "Robotics", "views": 187000, "rank": 3},
                    ]
                }
            ]
        }
