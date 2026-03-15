"""Render Background Worker: scrape Twitter accounts every 60 seconds."""

from __future__ import annotations

import asyncio
import logging
import time

from app.config import load_settings
from app.data.primary import connect_primary_database
from app.jobs.breaking_feed import run_breaking_feed_pipeline
from app.sources.twitter_scraper import scrape_twitter_accounts

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
LOGGER = logging.getLogger(__name__)

LOOP_INTERVAL_SECONDS = 60


def main() -> None:
    settings = load_settings()
    LOGGER.info("Twitter loop starting — interval=%ds", LOOP_INTERVAL_SECONDS)

    while True:
        start = time.perf_counter()
        try:
            connection = connect_primary_database(settings)
            stats = asyncio.run(scrape_twitter_accounts(settings, connection))
            breaking_count = run_breaking_feed_pipeline(settings, connection)
            connection.close()
            elapsed = time.perf_counter() - start
            LOGGER.info(
                "Twitter loop: checked=%d new=%d skipped=%d errors=%d breaking=%d elapsed=%.1fs",
                stats["accounts_checked"],
                stats["new_tweets"],
                stats["skipped"],
                stats["errors"],
                breaking_count,
                elapsed,
            )
        except Exception:
            LOGGER.exception("Twitter loop iteration failed")

        time.sleep(LOOP_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
