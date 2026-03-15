"""Ingestion job orchestration."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from time import perf_counter

from app.config import Settings
from app.models import RawSourceItem, SourceIngestionRun
from app.sources.arxiv import ArxivSourceAdapter
from app.sources.chrome_web_store import ChromeWebStoreSourceAdapter
from app.sources.curated_rss import CuratedRssSourceAdapter
from app.sources.devto import DevToSourceAdapter
from app.sources.github import GitHubSourceAdapter
from app.sources.google_news import GoogleNewsSourceAdapter
from app.sources.producthunt import ProductHuntSourceAdapter
from app.sources.huggingface import HuggingFaceSourceAdapter
from app.sources.lobsters import LobstersSourceAdapter
from app.sources.npm import NpmSourceAdapter
from app.sources.pypi import PyPISourceAdapter
from app.sources.stackoverflow import StackOverflowSourceAdapter
from app.sources.google_trends import GoogleTrendsSourceAdapter
from app.sources.hacker_news import HackerNewsSourceAdapter
from app.sources.polymarket import PolymarketSourceAdapter
from app.sources.reddit import RedditSourceAdapter
from app.sources.twitter import TwitterSourceAdapter
from app.sources.youtube import YouTubeSourceAdapter
from app.sources.wikipedia import WikipediaSourceAdapter
from app.sources.mastodon import MastodonSourceAdapter
from app.sources.coingecko import CoinGeckoSourceAdapter
from app.sources.apple_charts import AppleChartsSourceAdapter
from app.sources.tiktok import TikTokSourceAdapter
from app.sources.pinterest import PinterestSourceAdapter

LOGGER = logging.getLogger(__name__)


def fetch_source_items(settings: Settings) -> tuple[list[RawSourceItem], list[SourceIngestionRun]]:
    """Fetch items from all configured sources without failing the full run."""

    adapters = [
        RedditSourceAdapter(settings),
        HackerNewsSourceAdapter(settings),
        GitHubSourceAdapter(settings),
        WikipediaSourceAdapter(settings),
        GoogleTrendsSourceAdapter(settings),
        GoogleNewsSourceAdapter(settings),
        CuratedRssSourceAdapter(settings),
        ArxivSourceAdapter(settings),
        ChromeWebStoreSourceAdapter(settings),
        StackOverflowSourceAdapter(settings),
        ProductHuntSourceAdapter(settings),
        DevToSourceAdapter(settings),
        HuggingFaceSourceAdapter(settings),
        NpmSourceAdapter(settings),
        PyPISourceAdapter(settings),
        YouTubeSourceAdapter(settings),
        LobstersSourceAdapter(settings),
        MastodonSourceAdapter(settings),
        CoinGeckoSourceAdapter(settings),
        AppleChartsSourceAdapter(settings),
        TikTokSourceAdapter(settings),
        PinterestSourceAdapter(settings),
    ]
    if settings.enable_experimental_sources:
        adapters.append(PolymarketSourceAdapter(settings))
    if settings.enable_experimental_sources and settings.enable_twitter_source:
        adapters.append(TwitterSourceAdapter(settings))
    all_items: list[RawSourceItem] = []
    source_runs: list[SourceIngestionRun] = []
    for adapter in adapters:
        adapter.reset_fetch_state()
        fetched_at = datetime.now(tz=timezone.utc)
        started_at = perf_counter()
        try:
            source_items = adapter.fetch()
            duration_ms = int((perf_counter() - started_at) * 1000)
            LOGGER.info("Fetched %s items from %s", len(source_items), adapter.source_name)
            all_items.extend(source_items)
            raw_item_count = getattr(adapter, "raw_item_count", len(source_items))
            kept_item_count = getattr(adapter, "kept_item_count", len(source_items))
            source_runs.append(
                SourceIngestionRun(
                    source=adapter.source_name,
                    fetched_at=fetched_at,
                    success=True,
                    raw_item_count=raw_item_count,
                    item_count=len(source_items),
                    kept_item_count=kept_item_count,
                    duration_ms=duration_ms,
                    used_fallback=adapter.used_fallback,
                )
            )
        except Exception as error:
            duration_ms = int((perf_counter() - started_at) * 1000)
            LOGGER.exception("Unexpected failure while fetching %s: %s", adapter.source_name, error)
            source_runs.append(
                SourceIngestionRun(
                    source=adapter.source_name,
                    fetched_at=fetched_at,
                    success=False,
                    raw_item_count=getattr(adapter, "raw_item_count", 0),
                    item_count=0,
                    kept_item_count=getattr(adapter, "kept_item_count", 0),
                    duration_ms=duration_ms,
                    used_fallback=adapter.used_fallback,
                    error_message=str(error),
                )
            )
    return all_items, source_runs
