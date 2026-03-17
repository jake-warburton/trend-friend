"""Single-shot Twitter scrape + breaking feed update (for GitHub Actions)."""

from __future__ import annotations

import asyncio
import logging

from _bootstrap import bootstrap_project_root

bootstrap_project_root()

from app.config import load_settings
from app.data.primary import connect_primary_database
from app.jobs.breaking_feed import run_breaking_feed_pipeline
from app.sources.twitter_scraper import scrape_twitter_accounts
from app.sources.twitter_trends import scrape_twitter_trends

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
LOGGER = logging.getLogger(__name__)


def main() -> None:
    settings = load_settings()
    connection = connect_primary_database(settings)
    stats = asyncio.run(scrape_twitter_accounts(settings, connection))
    trend_stats = asyncio.run(scrape_twitter_trends(settings, connection))
    breaking_count = run_breaking_feed_pipeline(settings, connection)
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


if __name__ == "__main__":
    main()
