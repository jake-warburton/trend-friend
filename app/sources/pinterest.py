"""Pinterest source adapter for visual/lifestyle trend signals.

Fetches trending content from Pinterest's publicly accessible endpoints.
Uses a multi-strategy approach: trends API first, HTML scraping fallback,
then deterministic sample data as a final fallback.  Captures lifestyle,
home, fashion, and food trends that complement the tech-heavy signals
from other sources.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from app.models import RawSourceItem
from app.sources.base import SourceAdapter

TRENDS_API_URL = "https://trends.pinterest.com/api/"
"""Pinterest Trends API endpoint for fetching trending topics."""

COUNTRIES = ["US", "GB", "CA", "AU", "DE"]
"""Countries to query for trending topics."""

COUNTRY_TO_GEO = {
    "US": "US",
    "GB": "GB",
    "CA": "CA",
    "AU": "AU",
    "DE": "DE",
}

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"

TRENDS_PAGE_URL = "https://trends.pinterest.com"
"""Pinterest Trends page for HTML scraping fallback."""


class PinterestSourceAdapter(SourceAdapter):
    """Fetch trending topics from Pinterest using multiple strategies."""

    source_name = "pinterest"

    def fetch(self) -> list[RawSourceItem]:
        try:
            return self._fetch_trends()
        except Exception as error:
            self.log_fallback(error)
            return self._fallback_items()

    def _fetch_trends(self) -> list[RawSourceItem]:
        """Try the trends API first, fall back to HTML scraping."""

        items = self._try_trends_api()
        if items:
            return items

        items = self._try_html_scrape()
        if items:
            return items

        raise RuntimeError("All Pinterest fetch strategies failed")

    def _try_trends_api(self) -> list[RawSourceItem]:
        """Fetch trending topics from the Pinterest Trends API."""

        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
        items: list[RawSourceItem] = []
        seen_ids: set[str] = set()

        for country in COUNTRIES:
            url = (
                f"{TRENDS_API_URL}?query=&country={country}"
                f"&timeRange=this_month"
            )
            try:
                data = self.get_json(url, headers=headers)
            except Exception:
                continue

            trends = data if isinstance(data, list) else data.get("trends", data.get("results", []))
            if not isinstance(trends, list):
                continue

            self.raw_item_count += len(trends)

            for trend in trends:
                item = self._build_trend_item(trend, country)
                if item is None or item.external_id in seen_ids:
                    continue
                seen_ids.add(item.external_id)
                items.append(item)
                self.kept_item_count += 1
                if len(items) >= self.settings.max_items_per_source:
                    return items

        return items

    def _try_html_scrape(self) -> list[RawSourceItem]:
        """Scrape the Pinterest Trends page for trending topic links."""

        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html",
        }

        try:
            raw = self.get_url(TRENDS_PAGE_URL, headers=headers)
            html = raw.decode("utf-8", errors="replace")
        except Exception:
            return []

        # Look for trending topic links in the page HTML
        topic_matches = re.findall(
            r'href="/trending/([^"]+)"[^>]*>([^<]+)<', html
        )

        if not topic_matches:
            # Alternative pattern: JSON data embedded in the page
            json_matches = re.findall(
                r'"term"\s*:\s*"([^"]+)"', html
            )
            if json_matches:
                topic_matches = [
                    (term.lower().replace(" ", "-"), term) for term in json_matches
                ]

        if not topic_matches:
            return []

        self.raw_item_count += len(topic_matches)
        items: list[RawSourceItem] = []
        now = datetime.now(tz=timezone.utc)

        for position, (slug, title) in enumerate(topic_matches):
            title = title.strip()
            if not title:
                continue

            external_id = f"pin-trend:{slug}"
            engagement = max(500 - position * 10, 50)

            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=external_id,
                    title=title,
                    url=f"https://www.pinterest.com/search/pins/?q={slug}",
                    timestamp=now,
                    engagement_score=float(engagement),
                    metadata={"type": "scraped_trend"},
                    geo_country_code="US",
                    geo_detection_mode="explicit",
                    geo_confidence=0.85,
                )
            )
            self.kept_item_count += 1
            if len(items) >= self.settings.max_items_per_source:
                break

        return items

    def _build_trend_item(
        self, trend: dict, country: str
    ) -> RawSourceItem | None:
        """Normalize one trending topic from the API into a source item."""

        # The API may use different field names
        title = (
            trend.get("term", "")
            or trend.get("name", "")
            or trend.get("title", "")
        ).strip()
        if not title:
            return None

        interest_score = float(
            trend.get("interest", 0)
            or trend.get("value", 0)
            or trend.get("score", 0)
        )
        category = trend.get("category", "") or trend.get("vertical", "")
        trend_id = trend.get("id", title.lower().replace(" ", "-"))

        engagement = interest_score * 10 if interest_score > 0 else 200.0

        metadata: dict = {
            "interest_score": interest_score,
            "country": country,
        }
        if category:
            metadata["category"] = category

        return RawSourceItem(
            source=self.source_name,
            external_id=f"pin-api:{country}:{trend_id}",
            title=title,
            url=f"https://trends.pinterest.com/?query={title.replace(' ', '%20')}&country={country}",
            timestamp=datetime.now(tz=timezone.utc),
            engagement_score=engagement,
            metadata=metadata,
            geo_country_code=COUNTRY_TO_GEO.get(country),
            geo_detection_mode="explicit",
            geo_confidence=0.85,
        )

    def _fallback_items(self) -> list[RawSourceItem]:
        """Return deterministic sample data for local fallback runs."""

        now = datetime.now(tz=timezone.utc)
        items: list[RawSourceItem] = []

        for entry in self.sample_payload():
            items.append(
                RawSourceItem(
                    source=self.source_name,
                    external_id=entry["id"],
                    title=entry["title"],
                    url=f"https://www.pinterest.com/search/pins/?q={entry['title'].replace(' ', '%20')}",
                    timestamp=now,
                    engagement_score=float(entry["interest"]) * 10,
                    metadata={
                        "interest_score": entry["interest"],
                        "country": "US",
                        "category": entry.get("category", ""),
                    },
                    geo_country_code="US",
                    geo_detection_mode="explicit",
                    geo_confidence=0.85,
                )
            )

        return items[: self.settings.max_items_per_source]

    @staticmethod
    def sample_payload() -> list[dict]:
        return [
            {
                "id": "pin-1",
                "title": "Minimalist home decor ideas",
                "interest": 85,
                "category": "home",
            },
            {
                "id": "pin-2",
                "title": "Healthy meal prep recipes",
                "interest": 78,
                "category": "food",
            },
        ]
