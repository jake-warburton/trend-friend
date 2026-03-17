"""Shared web-data export flow."""

from __future__ import annotations

import json
import logging
from dataclasses import replace
from datetime import datetime, timezone

from app.config import Settings
from app.data.primary import connect_primary_database
from app.models import TrendDetailRecord
from app.data.repositories import (
    PipelineRunRepository,
    PublishedPayloadRepository,
    SignalRepository,
    SourceFamilySnapshotRepository,
    SourceIngestionRunRepository,
    TrendScoreRepository,
)
from app.exports.files import (
    AD_INTELLIGENCE_FILENAME,
    LATEST_TRENDS_FILENAME,
    OVERVIEW_V2_FILENAME,
    SOURCE_SUMMARY_V2_FILENAME,
    TREND_DETAIL_INDEX_V2_FILENAME,
    TREND_EXPLORER_V2_FILENAME,
    TREND_HISTORY_FILENAME,
    write_export_payloads,
    write_json,
)
from app.exports.serializers import (
    build_ad_intelligence_payload,
    build_dashboard_overview_payload,
    build_source_summary_payload,
    build_source_summary_records,
    build_trend_detail_index_payload,
    build_latest_trends_payload,
    build_trend_explorer_payload,
    build_trend_history_payload,
)

PIPELINE_RUN_LIMIT = 6
SOURCE_RUN_HISTORY_LIMIT = 6
SOURCE_FAMILY_HISTORY_LIMIT = 8


def export_web_data_payloads(settings: Settings) -> None:
    """Export web-facing JSON payloads from the configured primary database."""

    connection = connect_primary_database(settings)
    signal_repository = SignalRepository(connection)
    pipeline_run_repository = PipelineRunRepository(connection)
    published_payload_repository = PublishedPayloadRepository(connection)
    source_run_repository = SourceIngestionRunRepository(connection)
    source_family_repository = SourceFamilySnapshotRepository(connection)
    repository = TrendScoreRepository(connection)
    generated_at = datetime.now(tz=timezone.utc)
    signals = signal_repository.list_signals()
    pipeline_runs = pipeline_run_repository.list_recent_runs(limit=PIPELINE_RUN_LIMIT)
    source_runs = source_run_repository.list_latest_runs()
    source_run_history = source_run_repository.list_recent_runs(limit_per_source=SOURCE_RUN_HISTORY_LIMIT)
    latest_captured_at, latest_scores = repository.list_latest_snapshot(limit=settings.ranking_limit)
    _, experimental_scores = repository.list_latest_experimental_snapshot(limit=settings.experimental_ranking_limit)
    history = repository.list_score_history(
        limit_runs=settings.history_run_limit,
        per_run_limit=settings.ranking_limit,
    )
    explorer_records = repository.list_trend_explorer_records(limit=settings.ranking_limit)
    detail_records = repository.list_trend_detail_records(limit=settings.ranking_limit)
    detail_records = _enrich_with_wikipedia(detail_records)

    # Load breaking feed for cross-referencing
    from app.exports.serializers import _build_breaking_index
    breaking_index = _build_breaking_index(connection)

    latest_payload = build_latest_trends_payload(
        generated_at=latest_captured_at or generated_at,
        scores=latest_scores,
    )
    history_payload = build_trend_history_payload(generated_at=generated_at, snapshots=history)
    explorer_payload = build_trend_explorer_payload(
        generated_at=latest_captured_at or generated_at,
        trends=explorer_records,
        breaking_index=breaking_index,
    )
    detail_payload = build_trend_detail_index_payload(
        generated_at=latest_captured_at or generated_at,
        trends=detail_records,
        breaking_index=breaking_index,
    )
    overview_payload = build_dashboard_overview_payload(
        generated_at=latest_captured_at or generated_at,
        trends=detail_records,
        experimental_trends=experimental_scores,
        signals=signals,
        source_runs=source_runs,
        pipeline_runs=pipeline_runs,
    )
    source_summary_payload = build_source_summary_payload(
        generated_at=latest_captured_at or generated_at,
        sources=build_source_summary_records(
            trends=detail_records,
            signals=signals,
            latest_source_runs=source_runs,
            source_run_history=source_run_history,
        ),
        family_history=[
            snapshot
            for snapshots in source_family_repository.list_recent_snapshots(limit_per_family=SOURCE_FAMILY_HISTORY_LIMIT).values()
            for snapshot in snapshots
        ],
    )
    # Prefer pre-built ad intelligence payload (built from RawSourceItem with
    # full metadata in the ad pipeline) over the lossy signal-based fallback.
    cached_ad_json = published_payload_repository.get_payload("ad-intelligence.json")
    if cached_ad_json is not None:
        ad_intelligence_payload_dict = cached_ad_json if isinstance(cached_ad_json, dict) else json.loads(cached_ad_json)
    else:
        ad_intelligence_payload_dict = build_ad_intelligence_payload(
            generated_at=latest_captured_at or generated_at,
            signals=signals,
        ).to_dict()

    latest_payload_dict = latest_payload.to_dict()
    history_payload_dict = history_payload.to_dict()
    overview_payload_dict = overview_payload.to_dict()
    explorer_payload_dict = explorer_payload.to_dict()
    detail_payload_dict = detail_payload.to_dict()
    source_summary_payload_dict = source_summary_payload.to_dict()

    write_export_payloads(
        settings.web_data_path,
        latest_payload,
        history_payload,
        overview_payload,
        explorer_payload,
        detail_payload,
        source_summary_payload,
        # Pass None — we write ad intelligence JSON directly below
    )
    # Write ad intelligence JSON file separately (may be cached or freshly built)
    write_json(settings.web_data_path / AD_INTELLIGENCE_FILENAME, ad_intelligence_payload_dict)

    published_payload_repository.replace_payloads(
        [
            (LATEST_TRENDS_FILENAME, latest_payload_dict["generatedAt"], json.dumps(latest_payload_dict)),
            (TREND_HISTORY_FILENAME, history_payload_dict["generatedAt"], json.dumps(history_payload_dict)),
            (OVERVIEW_V2_FILENAME, overview_payload_dict["generatedAt"], json.dumps(overview_payload_dict)),
            (TREND_EXPLORER_V2_FILENAME, explorer_payload_dict["generatedAt"], json.dumps(explorer_payload_dict)),
            (TREND_DETAIL_INDEX_V2_FILENAME, detail_payload_dict["generatedAt"], json.dumps(detail_payload_dict)),
            (SOURCE_SUMMARY_V2_FILENAME, source_summary_payload_dict["generatedAt"], json.dumps(source_summary_payload_dict)),
            (AD_INTELLIGENCE_FILENAME, ad_intelligence_payload_dict["generatedAt"], json.dumps(ad_intelligence_payload_dict)),
        ]
    )
    connection.close()


logger = logging.getLogger(__name__)


def _enrich_with_wikipedia(records: list[TrendDetailRecord]) -> list[TrendDetailRecord]:
    """Attach Wikipedia summary data to detail records.

    First tries trends that already have Wikipedia evidence, then attempts
    Wikipedia lookups for remaining trends using their canonical name.
    This gives more trends a description and thumbnail.

    Passes context hints (category, sources, evidence) to disambiguate
    topics like "Rust" (programming language vs iron oxide).
    """

    from app.enrichment.wikipedia import WikipediaLookupHint, fetch_wikipedia_summaries

    title_to_record_indices: dict[str, list[int]] = {}
    title_to_hint: dict[str, WikipediaLookupHint] = {}
    already_mapped: set[int] = set()

    def _build_hint(record: TrendDetailRecord) -> WikipediaLookupHint:
        evidence_texts = [item.evidence for item in record.evidence_items[:5]]
        if record.summary:
            evidence_texts.insert(0, record.summary)
        return WikipediaLookupHint(
            category=record.category,
            sources=record.sources,
            evidence_texts=evidence_texts,
        )

    # Phase 1: Trends with existing Wikipedia evidence (high confidence match)
    for index, record in enumerate(records):
        wikipedia_item = next(
            (item for item in record.evidence_items if item.source == "wikipedia"),
            None,
        )
        if wikipedia_item is not None:
            title = wikipedia_item.evidence.strip()
            if title:
                title_to_record_indices.setdefault(title, []).append(index)
                title_to_hint[title] = _build_hint(record)
                already_mapped.add(index)

    # Phase 2: Try canonical trend names for records without Wikipedia evidence
    for index, record in enumerate(records):
        if index in already_mapped:
            continue
        name = record.name.strip()
        if name and len(name) >= 3:
            title_to_record_indices.setdefault(name, []).append(index)
            if name not in title_to_hint:
                title_to_hint[name] = _build_hint(record)

    if not title_to_record_indices:
        return records

    logger.info("Fetching Wikipedia summaries for %d topics", len(title_to_record_indices))
    summaries = fetch_wikipedia_summaries(list(title_to_record_indices), hints=title_to_hint)

    enriched = list(records)
    for title, summary in summaries.items():
        for index in title_to_record_indices.get(title, []):
            enriched[index] = replace(
                enriched[index],
                wikipedia_extract=summary.extract,
                wikipedia_description=summary.description,
                wikipedia_thumbnail_url=summary.thumbnail_url,
                wikipedia_page_url=summary.page_url,
            )

    logger.info("Attached Wikipedia data to %d records", len(summaries))
    return enriched
