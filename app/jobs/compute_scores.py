"""End-to-end trend computation pipeline."""

from __future__ import annotations

import logging
from time import perf_counter
from datetime import datetime, timezone

from app.config import Settings
from app.data.connection import DatabaseConnection
from app.data.primary import connect_primary_database
from app.data.repositories import (
    PipelineRunRepository,
    SignalRepository,
    SourceIngestionRunRepository,
    TrendScoreRepository,
    WatchlistRepository,
)
from app.models import PipelineRun, TrendScoreResult
from app.notifications.deliver import deliver_post_run_notifications
from app.notifications.digest import build_run_digest
from app.scoring.calculator import calculate_trend_scores
from app.scoring.quality import calculate_pipeline_quality_metrics, calculate_source_quality_metrics
from app.scoring.ranking import rank_topics_by_score
from app.topics.cluster import aggregate_topic_signals
from app.topics.extract import build_signals_from_items

LOGGER = logging.getLogger(__name__)


def run_trend_pipeline(settings: Settings) -> list[TrendScoreResult]:
    """Fetch source items, compute scores, persist the ranking, and evaluate alerts."""

    from app.jobs.ingest import fetch_source_items

    pipeline_started_at = perf_counter()
    source_items, source_runs = fetch_source_items(settings)
    normalized_signals = build_signals_from_items(source_items)
    aggregates = aggregate_topic_signals(normalized_signals)
    scores = calculate_trend_scores(aggregates)
    ranked_scores = rank_topics_by_score(scores, limit=settings.ranking_limit)
    quality_metrics = calculate_pipeline_quality_metrics(
        normalized_signals,
        aggregates,
        ranked_scores,
    )
    source_quality_metrics = calculate_source_quality_metrics(normalized_signals, aggregates)
    captured_at = datetime.now(tz=timezone.utc)
    successful_source_count = sum(1 for run in source_runs if run.success)
    enriched_source_runs = [
        SourceIngestionRun(
            source=run.source,
            fetched_at=run.fetched_at,
            success=run.success,
            raw_item_count=run.raw_item_count,
            item_count=run.item_count,
            kept_item_count=run.kept_item_count,
            duration_ms=run.duration_ms,
            raw_topic_count=source_quality_metrics.get(run.source).raw_topic_count if run.source in source_quality_metrics else 0,
            merged_topic_count=source_quality_metrics.get(run.source).merged_topic_count if run.source in source_quality_metrics else 0,
            duplicate_topic_count=source_quality_metrics.get(run.source).duplicate_topic_count if run.source in source_quality_metrics else 0,
            duplicate_topic_rate=source_quality_metrics.get(run.source).duplicate_topic_rate if run.source in source_quality_metrics else 0.0,
            used_fallback=run.used_fallback,
            error_message=run.error_message,
        )
        for run in source_runs
    ]

    connection = connect_primary_database(settings)
    SourceIngestionRunRepository(connection).append_runs(enriched_source_runs)
    SignalRepository(connection).replace_signals(normalized_signals)
    repository = TrendScoreRepository(connection)

    # Capture previous snapshot state before overwriting
    previous_snapshot = _build_previous_state(repository, settings.ranking_limit)

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
            raw_topic_count=quality_metrics.raw_topic_count,
            merged_topic_count=quality_metrics.merged_topic_count,
            duplicate_topic_count=quality_metrics.duplicate_topic_count,
            duplicate_topic_rate=quality_metrics.duplicate_topic_rate,
            multi_source_trend_count=quality_metrics.multi_source_trend_count,
            low_evidence_trend_count=quality_metrics.low_evidence_trend_count,
        )
    )

    # Evaluate and persist alert events
    alert_events = _run_alert_evaluation(
        connection=connection,
        repository=repository,
        ranked_scores=ranked_scores,
        previous_state=previous_snapshot,
        ranking_limit=settings.ranking_limit,
    )

    digest = build_run_digest(
        current_scores=ranked_scores,
        previous_scores=previous_snapshot["scores"],
        current_ranks={score.topic: rank for rank, score in enumerate(ranked_scores, start=1)},
        previous_ranks=previous_snapshot["ranks"],
        statuses={record.score.topic: record.status for record in repository.list_trend_explorer_records(limit=settings.ranking_limit)},
    )
    deliver_post_run_notifications(
        connection=connection,
        run_at=captured_at,
        alert_events=alert_events,
        digest=digest,
    )

    connection.close()
    return ranked_scores


def _build_previous_state(
    repository: TrendScoreRepository,
    ranking_limit: int,
) -> dict:
    """Capture the previous snapshot state for alert evaluation."""

    _, previous_scores = repository.list_latest_snapshot(limit=ranking_limit)
    previous_ranks: dict[str, int] = {}
    previous_trend_ids: set[str] = set()
    for rank, score in enumerate(previous_scores, start=1):
        previous_ranks[score.topic] = rank
        previous_trend_ids.add(score.topic)
    return {
        "scores": previous_scores,
        "ranks": previous_ranks,
        "trend_ids": previous_trend_ids,
    }


def _run_alert_evaluation(
    connection: DatabaseConnection,
    repository: TrendScoreRepository,
    ranked_scores: list[TrendScoreResult],
    previous_state: dict,
    ranking_limit: int,
) -> list:
    """Evaluate alert rules against the just-computed scores and persist events."""

    from app.alerts.evaluate import evaluate_alerts

    watchlist_repo = WatchlistRepository(connection)
    rules = watchlist_repo.list_all_alert_rules()
    if not rules:
        return []

    watchlist_trend_ids = watchlist_repo.get_watchlist_trend_ids()
    current_ranks = {score.topic: rank for rank, score in enumerate(ranked_scores, start=1)}

    # Build statuses from explorer records
    explorer_records = repository.list_trend_explorer_records(limit=ranking_limit)
    statuses = {record.score.topic: record.status for record in explorer_records}

    events = evaluate_alerts(
        rules=rules,
        watchlist_trend_ids=watchlist_trend_ids,
        current_scores=ranked_scores,
        previous_scores=previous_state["scores"],
        current_ranks=current_ranks,
        previous_ranks=previous_state["ranks"],
        statuses=statuses,
        previous_trend_ids=previous_state["trend_ids"],
    )

    if events:
        watchlist_repo.save_alert_events(events)
        LOGGER.info("Triggered %d alert events", len(events))
    return events
