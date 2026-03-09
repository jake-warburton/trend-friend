"""Ingestion job orchestration."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.config import Settings
from app.models import RawSourceItem, SourceIngestionRun
from app.sources.github import GitHubSourceAdapter
from app.sources.hacker_news import HackerNewsSourceAdapter
from app.sources.reddit import RedditSourceAdapter
from app.sources.wikipedia import WikipediaSourceAdapter

LOGGER = logging.getLogger(__name__)


def fetch_source_items(settings: Settings) -> tuple[list[RawSourceItem], list[SourceIngestionRun]]:
    """Fetch items from all configured sources without failing the full run."""

    adapters = [
        RedditSourceAdapter(settings),
        HackerNewsSourceAdapter(settings),
        GitHubSourceAdapter(settings),
        WikipediaSourceAdapter(settings),
    ]
    all_items: list[RawSourceItem] = []
    source_runs: list[SourceIngestionRun] = []
    for adapter in adapters:
        fetched_at = datetime.now(tz=timezone.utc)
        try:
            source_items = adapter.fetch()
            LOGGER.info("Fetched %s items from %s", len(source_items), adapter.source_name)
            all_items.extend(source_items)
            source_runs.append(
                SourceIngestionRun(
                    source=adapter.source_name,
                    fetched_at=fetched_at,
                    success=True,
                    item_count=len(source_items),
                )
            )
        except Exception as error:
            LOGGER.exception("Unexpected failure while fetching %s: %s", adapter.source_name, error)
            source_runs.append(
                SourceIngestionRun(
                    source=adapter.source_name,
                    fetched_at=fetched_at,
                    success=False,
                    item_count=0,
                    error_message=str(error),
                )
            )
    return all_items, source_runs
