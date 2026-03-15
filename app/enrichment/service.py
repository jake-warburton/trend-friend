"""Run external market-footprint enrichers for ranked trends."""

from __future__ import annotations

import logging
from datetime import datetime

from app.config import Settings
from app.data.repositories import TrendScoreRepository
from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.enrichment.github import GitHubMetricsEnricher
from app.enrichment.huggingface import HuggingFaceEnricher
from app.enrichment.google_autocomplete import GoogleAutocompleteEnricher
from app.enrichment.google_search import GoogleSearchMetricsEnricher
from app.enrichment.google_trends import GoogleTrendsEnricher
from app.enrichment.growth import compute_growth_metrics
from app.enrichment.npm import NpmDownloadsEnricher
from app.enrichment.pypi import PyPIDownloadsEnricher
from app.enrichment.stackoverflow import StackOverflowEnricher
from app.enrichment.tiktok import TikTokMetricsEnricher
from app.enrichment.wikipedia_metrics import WikipediaPageviewsEnricher
from app.enrichment.youtube import YouTubeMetricsEnricher
from app.models import TrendScoreResult

LOGGER = logging.getLogger(__name__)

# Sources that indicate a trend is developer/tech-oriented
_DEV_SOURCES = {"github", "npm", "pypi", "stackoverflow", "huggingface", "lobsters", "devto"}

# Sources that indicate a trend has broad consumer appeal
_CONSUMER_SOURCES = {"reddit", "youtube", "google_trends", "google_news", "curated_feeds", "tiktok", "apple_charts", "pinterest"}


def _select_enrichers_for_trend(
    settings: Settings,
    source_counts: dict[str, int],
) -> list[MarketMetricEnricher]:
    """Select relevant enrichers based on the trend's source composition.

    Universal enrichers (Google, YouTube, Wikipedia, TikTok) run for all trends.
    Developer-specific enrichers (npm, PyPI, GitHub, SO, HuggingFace) only run
    when the trend has signals from developer sources.
    """

    # Universal enrichers — always relevant
    enrichers: list[MarketMetricEnricher] = [
        GoogleSearchMetricsEnricher(settings),
        GoogleTrendsEnricher(settings),
        GoogleAutocompleteEnricher(settings),
        YouTubeMetricsEnricher(settings),
        WikipediaPageviewsEnricher(settings),
    ]

    # Consumer-facing enricher
    has_consumer_signal = bool(set(source_counts) & _CONSUMER_SOURCES)
    if has_consumer_signal:
        enrichers.append(TikTokMetricsEnricher(settings))

    # Developer-specific enrichers
    has_dev_signal = bool(set(source_counts) & _DEV_SOURCES)
    if has_dev_signal:
        enrichers.append(NpmDownloadsEnricher(settings))
        enrichers.append(PyPIDownloadsEnricher(settings))
        enrichers.append(GitHubMetricsEnricher(settings))
        enrichers.append(StackOverflowEnricher(settings))

    # AI/ML-specific enricher
    if "huggingface" in source_counts or "arxiv" in source_counts:
        enrichers.append(HuggingFaceEnricher(settings))

    return enrichers


def refresh_external_market_metrics(
    settings: Settings,
    repository: TrendScoreRepository,
    scores: list[TrendScoreResult],
    *,
    captured_at: datetime,
) -> None:
    """Upsert external market-footprint metrics for the current ranked trends."""

    if not settings.market_enrichment_enabled:
        return

    for score in scores[: settings.market_enrichment_limit]:
        entity = repository.get_trend_entity(score.topic)
        target = EnrichmentTarget(
            topic=score.topic,
            name=entity.canonical_name if entity is not None else score.display_name or score.topic.title(),
            aliases=entity.aliases if entity is not None else [],
        )
        enrichers = _select_enrichers_for_trend(settings, score.source_counts)
        snapshots = []
        for enricher in enrichers:
            try:
                snapshots.extend(enricher.enrich(target, captured_at))
            except Exception as error:
                LOGGER.warning("Market enricher %s failed for %s: %s", enricher.source_name, score.topic, error)
        try:
            snapshots.extend(compute_growth_metrics(repository, score.topic, captured_at))
        except Exception as error:
            LOGGER.warning("Growth metrics failed for %s: %s", score.topic, error)
        if snapshots:
            repository.upsert_topic_market_footprint(score.topic, snapshots)
