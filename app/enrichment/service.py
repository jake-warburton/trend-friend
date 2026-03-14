"""Run external market-footprint enrichers for ranked trends."""

from __future__ import annotations

import logging
from datetime import datetime

from app.config import Settings
from app.data.repositories import TrendScoreRepository
from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.enrichment.google_search import GoogleSearchMetricsEnricher
from app.enrichment.tiktok import TikTokMetricsEnricher
from app.enrichment.youtube import YouTubeMetricsEnricher
from app.models import TrendScoreResult

LOGGER = logging.getLogger(__name__)


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

    enrichers: list[MarketMetricEnricher] = [
        GoogleSearchMetricsEnricher(settings),
        YouTubeMetricsEnricher(settings),
        TikTokMetricsEnricher(settings),
    ]
    for score in scores[: settings.market_enrichment_limit]:
        entity = repository.get_trend_entity(score.topic)
        target = EnrichmentTarget(
            topic=score.topic,
            name=entity.canonical_name if entity is not None else score.display_name or score.topic.title(),
            aliases=entity.aliases if entity is not None else [],
        )
        snapshots = []
        for enricher in enrichers:
            try:
                snapshots.extend(enricher.enrich(target, captured_at))
            except Exception as error:
                LOGGER.warning("Market enricher %s failed for %s: %s", enricher.source_name, score.topic, error)
        if snapshots:
            repository.upsert_topic_market_footprint(score.topic, snapshots)
