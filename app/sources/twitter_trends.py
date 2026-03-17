"""Fetch Twitter/X trending topics using twikit.

Uses the same cookie-based auth as the tweet scraper. Fetches:
  - Global trends by category (trending, for-you, news, sports, entertainment)
  - Location-specific trends (top 50 per WOEID)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.config import Settings
from app.data.connection import DatabaseConnection
from app.data.repositories import TwitterTrendRepository

LOGGER = logging.getLogger(__name__)

TREND_CATEGORIES = ("trending", "for-you", "news", "sports", "entertainment")

# Key locations by WOEID (Yahoo Where On Earth ID)
PLACE_WOEIDS = {
    1: "Worldwide",
    23424977: "United States",
    23424975: "United Kingdom",
    23424748: "Australia",
    23424775: "Canada",
    23424829: "Germany",
    23424819: "France",
    23424856: "Japan",
    23424848: "India",
    23424768: "Brazil",
}


async def scrape_twitter_trends(
    settings: Settings,
    connection: DatabaseConnection,
) -> dict[str, int]:
    """Fetch trending topics and store them. Returns stats dict."""

    import twikit

    cookies_json = settings.twitter_cookies_json
    if not cookies_json:
        LOGGER.error("TWITTER_COOKIES_JSON not set — cannot fetch trends")
        return {"categories_fetched": 0, "places_fetched": 0, "total_trends": 0, "errors": 0}

    cookies = json.loads(cookies_json)
    client = twikit.Client("en-US")
    client.set_cookies(cookies)

    repo = TwitterTrendRepository(connection)
    now = datetime.now(tz=timezone.utc).isoformat()
    stats = {"categories_fetched": 0, "places_fetched": 0, "total_trends": 0, "errors": 0}
    rows: list[tuple] = []

    # 1. Global trends by category
    for category in TREND_CATEGORIES:
        try:
            trends = await client.get_trends(category, count=20)
            for trend in trends:
                rows.append((
                    trend.name,
                    category,
                    "global",
                    None,
                    None,
                    getattr(trend, "domain_context", None),
                    json.dumps(getattr(trend, "grouped_trends", [])),
                    None,
                    None,
                    now,
                ))
            stats["categories_fetched"] += 1
            LOGGER.info("Category '%s': %d trends", category, len(trends))
        except Exception as exc:
            LOGGER.warning("Failed to fetch category '%s': %s", category, exc)
            stats["errors"] += 1

    # 2. Location-specific trends
    for woeid, location_name in PLACE_WOEIDS.items():
        try:
            result = await client.get_place_trends(woeid)
            place_trends = result.get("trends", []) if isinstance(result, dict) else []
            for trend in place_trends:
                tweet_volume = getattr(trend, "tweet_volume", None)
                rows.append((
                    trend.name,
                    "place",
                    location_name,
                    woeid,
                    tweet_volume,
                    None,
                    None,
                    getattr(trend, "query", None),
                    getattr(trend, "url", None),
                    now,
                ))
            stats["places_fetched"] += 1
            LOGGER.info("Place '%s' (WOEID %d): %d trends", location_name, woeid, len(place_trends))
        except Exception as exc:
            LOGGER.warning("Failed to fetch trends for '%s' (WOEID %d): %s", location_name, woeid, exc)
            stats["errors"] += 1

    if rows:
        repo.insert_trends(rows)
        stats["total_trends"] = len(rows)
        LOGGER.info("Stored %d trending topics total", len(rows))

    # Prune old entries (keep 48h)
    repo.prune(keep_hours=48)

    return stats
