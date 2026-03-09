"""End-to-end trend computation pipeline."""

from __future__ import annotations

from app.config import Settings
from app.data.database import connect_database, initialize_database
from app.data.repositories import SignalRepository, TrendScoreRepository
from app.models import TrendScoreResult
from app.scoring.calculator import calculate_trend_scores
from app.scoring.ranking import rank_topics_by_score
from app.topics.cluster import aggregate_topic_signals
from app.topics.extract import build_signals_from_items


def run_trend_pipeline(settings: Settings) -> list[TrendScoreResult]:
    """Fetch source items, compute scores, and persist the latest ranking."""

    from app.jobs.ingest import fetch_source_items

    source_items = fetch_source_items(settings)
    normalized_signals = build_signals_from_items(source_items)
    aggregates = aggregate_topic_signals(normalized_signals)
    scores = calculate_trend_scores(aggregates)
    ranked_scores = rank_topics_by_score(scores, limit=settings.ranking_limit)

    connection = connect_database(settings.database_path)
    initialize_database(connection)
    SignalRepository(connection).replace_signals(normalized_signals)
    TrendScoreRepository(connection).replace_scores(ranked_scores)
    connection.close()

    return ranked_scores
