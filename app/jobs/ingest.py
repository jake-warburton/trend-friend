"""Ingestion job orchestration."""

from __future__ import annotations

import logging

from app.config import Settings
from app.models import RawSourceItem
from app.sources.github import GitHubSourceAdapter
from app.sources.hacker_news import HackerNewsSourceAdapter
from app.sources.reddit import RedditSourceAdapter
from app.sources.wikipedia import WikipediaSourceAdapter

LOGGER = logging.getLogger(__name__)


def fetch_source_items(settings: Settings) -> list[RawSourceItem]:
    """Fetch items from all configured sources without failing the full run."""

    adapters = [
        RedditSourceAdapter(settings),
        HackerNewsSourceAdapter(settings),
        GitHubSourceAdapter(settings),
        WikipediaSourceAdapter(settings),
    ]
    all_items: list[RawSourceItem] = []
    for adapter in adapters:
        try:
            source_items = adapter.fetch()
            LOGGER.info("Fetched %s items from %s", len(source_items), adapter.source_name)
            all_items.extend(source_items)
        except Exception as error:
            LOGGER.exception("Unexpected failure while fetching %s: %s", adapter.source_name, error)
    return all_items
