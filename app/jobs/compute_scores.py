"""End-to-end trend computation pipeline."""

from __future__ import annotations

from time import perf_counter
from datetime import datetime, timezone

from app.config import Settings
from app.data.database import connect_database, initialize_database
from app.data.repositories import (
    PipelineRunRepository,
    SignalRepository,
    SourceIngestionRunRepository,
    TrendScoreRepository,
)
from app.models import PipelineRun, TrendScoreResult
from app.scoring.calculator import calculate_trend_scores
from app.scoring.ranking import rank_topics_by_score
from app.topics.cluster import aggregate_topic_signals
from app.topics.extract import build_signals_from_items


def run_trend_pipeline(settings: Settings) -> list[TrendScoreResult]:
    """Fetch source items, compute scores, and persist the latest ranking."""

    from app.jobs.ingest import fetch_source_items

    pipeline_started_at = perf_counter()
    source_items, source_runs = fetch_source_items(settings)
    normalized_signals = build_signals_from_items(source_items)
    aggregates = aggregate_topic_signals(normalized_signals)
    scores = calculate_trend_scores(aggregates)
    ranked_scores = rank_topics_by_score(scores, limit=settings.ranking_limit)
    captured_at = datetime.now(tz=timezone.utc)
    successful_source_count = sum(1 for run in source_runs if run.success)

    connection = connect_database(settings.database_path)
    initialize_database(connection)
    SourceIngestionRunRepository(connection).append_runs(source_runs)
    SignalRepository(connection).replace_signals(normalized_signals)
    repository = TrendScoreRepository(connection)
    repository.replace_scores(ranked_scores)
    repository.append_snapshot(ranked_scores, captured_at=captured_at)
    PipelineRunRepository(connection).append_run(
        PipelineRun(
            captured_at=captured_at,
            duration_ms=round((perf_counter() - pipeline_started_at) * 1000),
            source_count=len(source_runs),
            successful_source_count=successful_source_count,
            failed_source_count=len(source_runs) - successful_source_count,
            signal_count=len(normalized_signals),
            ranked_trend_count=len(ranked_scores),
            top_topic=ranked_scores[0].topic if ranked_scores else None,
            top_score=ranked_scores[0].total_score if ranked_scores else None,
        )
    )
    connection.close()

    return ranked_scores
