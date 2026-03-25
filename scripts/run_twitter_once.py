"""Single-shot Twitter scrape + breaking feed update (for GitHub Actions)."""

from __future__ import annotations

import asyncio
import logging

try:
    from _bootstrap import bootstrap_project_root
except ModuleNotFoundError:
    from scripts._bootstrap import bootstrap_project_root

bootstrap_project_root()

from app.config import load_settings
from app.data.primary import connect_primary_database
from app.jobs.breaking_feed import run_breaking_feed_pipeline
from app.sources.twitter_scraper import scrape_twitter_accounts
from app.sources.twitter_trends import scrape_twitter_trends

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
LOGGER = logging.getLogger(__name__)


def validate_twitter_refresh_outputs(
    tweet_stats: dict[str, int],
    trend_stats: dict[str, int],
) -> None:
    """Fail loudly when the social trend data path produced nothing."""

    total_trends = trend_stats.get("total_trends", 0)
    if total_trends > 0:
        return

    categories_fetched = trend_stats.get("categories_fetched", 0)
    places_fetched = trend_stats.get("places_fetched", 0)
    errors = trend_stats.get("errors", 0)
    accounts_checked = tweet_stats.get("accounts_checked", 0)
    new_tweets = tweet_stats.get("new_tweets", 0)

    raise RuntimeError(
        "Twitter refresh completed without any trend rows. "
        f"categories_fetched={categories_fetched}, "
        f"places_fetched={places_fetched}, "
        f"errors={errors}, "
        f"accounts_checked={accounts_checked}, "
        f"new_tweets={new_tweets}. "
        "This usually means TWITTER_COOKIES_JSON is missing/expired, "
        "the workflow is pointed at the wrong database, or X trend endpoints failed."
    )


def main() -> None:
    settings = load_settings()
    connection = connect_primary_database(settings)
    try:
        stats = asyncio.run(scrape_twitter_accounts(settings, connection))
        trend_stats = asyncio.run(scrape_twitter_trends(settings, connection))
        breaking_count = run_breaking_feed_pipeline(settings, connection)
    finally:
        connection.close()

    LOGGER.info(
        "Twitter once: checked=%d new=%d skipped=%d errors=%d breaking=%d",
        stats["accounts_checked"],
        stats["new_tweets"],
        stats["skipped"],
        stats["errors"],
        breaking_count,
    )
    LOGGER.info(
        "Trends: categories=%d places=%d total=%d errors=%d",
        trend_stats["categories_fetched"],
        trend_stats["places_fetched"],
        trend_stats["total_trends"],
        trend_stats["errors"],
    )

    validate_twitter_refresh_outputs(stats, trend_stats)


if __name__ == "__main__":
    main()
