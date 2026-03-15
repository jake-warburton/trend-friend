"""Serialize stored trends into frontend-facing payloads."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from app.exports.contracts import (
    AdIntelligenceAdvertiserPayload,
    AdIntelligenceKeywordPayload,
    AdIntelligencePayload,
    AdIntelligencePlatformSummaryPayload,
    BreakoutPredictionPayload,
    DashboardOverviewChartDatumPayload,
    DashboardOverviewChartsPayload,
    DashboardOverviewHighlightsPayload,
    DashboardOverviewOperationsPayload,
    DashboardOverviewPayload,
    DashboardOverviewRunPayload,
    DashboardOverviewSourceWatchPayload,
    DashboardOverviewSectionsPayload,
    DashboardOverviewMetaTrendPayload,
    DashboardOverviewSourcePayload,
    DashboardOverviewSummaryPayload,
    DashboardOverviewTrendItemPayload,
    LatestTrendsPayload,
    SourceRunPayload,
    SourceFamilySnapshotPayload,
    SourceSummaryPayload,
    SourceSummaryRecordPayload,
    SourceSummaryTrendPayload,
    OpportunityPayload,
    RelatedTrendPayload,
    TrendDuplicateCandidatePayload,
    TrendCoveragePayload,
    TrendDetailIndexPayload,
    TrendDetailRecordPayload,
    TrendAudienceSegmentPayload,
    TrendEvidenceItemPayload,
    TrendForecastPayload,
    TrendGeoSummaryPayload,
    TrendExplorerPayload,
    TrendExplorerRecordPayload,
    TrendHistoryPointPayload,
    TrendHistoryPayload,
    TrendMarketMetricPayload,
    TrendMomentumPayload,
    TrendPrimaryEvidencePayload,
    TrendRecord,
    SeasonalityPayload,
    TrendScoreComponents,
    TrendSourceContributionPayload,
    TrendSourceBreakdownPayload,
    TrendSnapshotPayload,
)
from app.models import (
    NormalizedSignal,
    PipelineRun,
    RelatedTrend,
    SourceIngestionRun,
    SourceFamilySnapshot,
    SourceSummaryRecord,
    SourceWatchRecord,
    SourceSummaryTrend,
    TrendDetailRecord,
    TrendDuplicateCandidate,
    TrendExplorerRecord,
    TrendScoreResult,
)
from app.sources.catalog import source_family_for_source
from app.topics.categorize import categorize_topic
from app.topics.display import build_display_name, fallback_display_name


def build_latest_trends_payload(
    generated_at: datetime,
    scores: list[TrendScoreResult],
) -> LatestTrendsPayload:
    """Create the latest trends payload."""

    return LatestTrendsPayload(
        generated_at=to_timestamp(generated_at),
        trends=[serialize_trend(score, rank) for rank, score in enumerate(scores, start=1)],
    )


def build_trend_history_payload(
    generated_at: datetime,
    snapshots: list[tuple[datetime, list[TrendScoreResult]]],
) -> TrendHistoryPayload:
    """Create the trend history payload."""

    return TrendHistoryPayload(
        generated_at=to_timestamp(generated_at),
        snapshots=[
            TrendSnapshotPayload(
                captured_at=to_timestamp(captured_at),
                trends=[serialize_trend(score, rank) for rank, score in enumerate(scores, start=1)],
            )
            for captured_at, scores in snapshots
        ],
    )


def build_trend_explorer_payload(
    generated_at: datetime,
    trends: list[TrendExplorerRecord],
) -> TrendExplorerPayload:
    """Create the explorer payload for Dashboard V2."""

    return TrendExplorerPayload(
        generated_at=to_timestamp(generated_at),
        trends=[serialize_explorer_trend(trend) for trend in trends],
    )


def build_trend_detail_index_payload(
    generated_at: datetime,
    trends: list[TrendDetailRecord],
) -> TrendDetailIndexPayload:
    """Create the detail index payload for Dashboard V2."""

    return TrendDetailIndexPayload(
        generated_at=to_timestamp(generated_at),
        trends=[serialize_detail_trend(trend) for trend in trends],
    )


def build_dashboard_overview_payload(
    generated_at: datetime,
    trends: list[TrendDetailRecord],
    experimental_trends: list[TrendScoreResult],
    signals: list[NormalizedSignal],
    source_runs: list[SourceIngestionRun],
    pipeline_runs: list[PipelineRun],
) -> DashboardOverviewPayload:
    """Create the overview payload for the dashboard landing page."""

    ordered_trends = sorted(trends, key=lambda trend: trend.rank)
    source_summaries = build_source_summaries(signals, source_runs)
    biggest_mover = max(
        ordered_trends,
        key=lambda trend: trend.rank_change if trend.rank_change is not None else float("-inf"),
        default=None,
    )
    newest_trend = max(
        ordered_trends,
        key=lambda trend: trend.first_seen_at or generated_at,
        default=None,
    )
    average_score = round(
        sum(trend.score.total_score for trend in ordered_trends) / len(ordered_trends),
        1,
    ) if ordered_trends else 0.0

    return DashboardOverviewPayload(
        generated_at=to_timestamp(generated_at),
        summary=DashboardOverviewSummaryPayload(
            tracked_trends=len(ordered_trends),
            total_signals=len(signals),
            source_count=len(source_summaries),
            average_score=average_score,
        ),
        highlights=DashboardOverviewHighlightsPayload(
            top_trend_id=ordered_trends[0].id if ordered_trends else None,
            top_trend_name=ordered_trends[0].name if ordered_trends else None,
            biggest_mover_id=biggest_mover.id if biggest_mover is not None else None,
            biggest_mover_name=biggest_mover.name if biggest_mover is not None else None,
            newest_trend_id=newest_trend.id if newest_trend is not None else None,
            newest_trend_name=newest_trend.name if newest_trend is not None else None,
        ),
        charts=build_dashboard_charts_payload(ordered_trends, source_summaries),
        sections=build_dashboard_sections_payload(ordered_trends, experimental_trends),
        operations=build_dashboard_operations_payload(pipeline_runs),
        sources=source_summaries,
        source_watch=[
            DashboardOverviewSourceWatchPayload(
                source=item.source,
                severity=item.severity,
                title=item.title,
                detail=item.detail,
            )
            for item in build_source_watch_records(source_summaries)
        ],
    )


def build_source_summary_payload(
    generated_at: datetime,
    sources: list[SourceSummaryRecord],
    family_history: list[SourceFamilySnapshot] | None = None,
) -> SourceSummaryPayload:
    """Create the source summary payload for Dashboard V2."""

    return SourceSummaryPayload(
        generated_at=to_timestamp(generated_at),
        sources=[
            SourceSummaryRecordPayload(
                source=source.source,
                family=source.family,
                status=source.status,
                latest_fetch_at=to_optional_timestamp(source.latest_fetch_at),
                latest_success_at=to_optional_timestamp(source.latest_success_at),
                raw_item_count=source.raw_item_count,
                latest_item_count=source.latest_item_count,
                kept_item_count=source.kept_item_count,
                yield_rate_percent=source.yield_rate_percent,
                signal_yield_ratio=source.signal_yield_ratio,
                duration_ms=source.duration_ms,
                raw_topic_count=source.raw_topic_count,
                merged_topic_count=source.merged_topic_count,
                duplicate_topic_count=source.duplicate_topic_count,
                duplicate_topic_rate=source.duplicate_topic_rate,
                used_fallback=source.used_fallback,
                error_message=source.error_message,
                signal_count=source.signal_count,
                trend_count=source.trend_count,
                run_history=[
                    SourceRunPayload(
                        fetched_at=to_timestamp(run.fetched_at),
                        success=run.success,
                        raw_item_count=run.raw_item_count,
                        item_count=run.item_count,
                        kept_item_count=run.kept_item_count,
                        yield_rate_percent=build_yield_rate_percent(run),
                        duration_ms=run.duration_ms,
                        raw_topic_count=run.raw_topic_count,
                        merged_topic_count=run.merged_topic_count,
                        duplicate_topic_count=run.duplicate_topic_count,
                        duplicate_topic_rate=run.duplicate_topic_rate,
                        used_fallback=run.used_fallback,
                        error_message=run.error_message,
                    )
                    for run in source.run_history
                ],
                top_trends=[
                    SourceSummaryTrendPayload(
                        id=trend.id,
                        name=trend.name,
                        rank=trend.rank,
                        score_total=trend.score_total,
                    )
                    for trend in source.top_trends
                ],
            )
            for source in sources
        ],
        family_history=[
            SourceFamilySnapshotPayload(
                family=snapshot.family,
                label=format_source_family_label(snapshot.family),
                captured_at=to_timestamp(snapshot.captured_at),
                source_count=snapshot.source_count,
                healthy_source_count=snapshot.healthy_source_count,
                signal_count=snapshot.signal_count,
                trend_count=snapshot.trend_count,
                corroborated_trend_count=snapshot.corroborated_trend_count,
                top_ranked_trend_count=snapshot.top_ranked_trend_count,
                average_score=snapshot.average_score,
                average_yield_rate_percent=snapshot.average_yield_rate_percent,
                success_rate_percent=snapshot.success_rate_percent,
            )
            for snapshot in (family_history or [])
        ],
    )


def format_source_family_label(family: str) -> str:
    """Return a readable label for a cross-source family bucket."""

    labels = {
        "community": "Community",
        "developer": "Developer",
        "distribution": "Distribution",
        "editorial": "Editorial",
        "knowledge": "Knowledge",
        "market": "Market",
        "research": "Research",
        "advertising": "Advertising",
        "search": "Search",
        "social": "Social",
        "other": "Other",
    }
    return labels.get(family, family.replace("_", " ").title())


def serialize_trend(score: TrendScoreResult, rank: int) -> TrendRecord:
    """Convert an internal trend score into the public contract."""

    return TrendRecord(
        id=slugify(score.topic),
        name=score.display_name or build_display_name(score.topic, score.evidence),
        rank=rank,
        score=TrendScoreComponents(
            total=round(score.total_score, 1),
            social=round(score.social_score, 1),
            developer=round(score.developer_score, 1),
            knowledge=round(score.knowledge_score, 1),
            search=round(score.search_score, 1),
            advertising=round(score.advertising_score, 1),
            diversity=round(score.diversity_score, 1),
        ),
        sources=sorted(score.source_counts),
        evidence=score.evidence,
        latest_signal_at=to_timestamp(score.latest_timestamp),
    )


def serialize_explorer_trend(trend: TrendExplorerRecord) -> TrendExplorerRecordPayload:
    """Convert an internal explorer record into the public V2 contract."""

    return TrendExplorerRecordPayload(
        id=trend.id,
        name=trend.name,
        category=trend.category,
        meta_trend=trend.meta_trend,
        stage=trend.stage,
        confidence=round(trend.confidence, 3),
        summary=trend.summary,
        status=trend.status,
        volatility=trend.volatility,
        rank=trend.rank,
        previous_rank=trend.previous_rank,
        rank_change=trend.rank_change,
        first_seen_at=to_optional_timestamp(trend.first_seen_at),
        latest_signal_at=to_timestamp(trend.latest_signal_at),
        score=TrendScoreComponents(
            total=round(trend.score.total_score, 1),
            social=round(trend.score.social_score, 1),
            developer=round(trend.score.developer_score, 1),
            knowledge=round(trend.score.knowledge_score, 1),
            search=round(trend.score.search_score, 1),
            advertising=round(trend.score.advertising_score, 1),
            diversity=round(trend.score.diversity_score, 1),
        ),
        momentum=TrendMomentumPayload(
            previous_rank=trend.momentum.previous_rank,
            rank_change=trend.momentum.rank_change,
            absolute_delta=trend.momentum.absolute_delta,
            percent_delta=trend.momentum.percent_delta,
        ),
        coverage=TrendCoveragePayload(
            source_count=trend.source_count,
            signal_count=trend.signal_count,
        ),
        sources=sorted(trend.score.source_counts),
        evidence_preview=trend.score.evidence[:2],
        audience_summary=[
            TrendAudienceSegmentPayload(
                segment_type=item.segment_type,
                label=item.label,
                signal_count=item.signal_count,
            )
            for item in trend.audience_summary
        ],
        primary_evidence=(
            TrendPrimaryEvidencePayload(
                source=trend.primary_evidence.source,
                signal_type=trend.primary_evidence.signal_type,
                timestamp=to_timestamp(trend.primary_evidence.timestamp),
                value=round(trend.primary_evidence.value, 1),
                evidence=trend.primary_evidence.evidence,
                evidence_url=trend.primary_evidence.evidence_url,
            )
            if trend.primary_evidence is not None
            else None
        ),
        recent_history=[
            TrendHistoryPointPayload(
                captured_at=to_timestamp(point.captured_at),
                rank=point.rank,
                score_total=round(point.score_total, 1),
            )
            for point in trend.recent_history
        ],
        seasonality=(
            SeasonalityPayload(
                tag=trend.seasonality.tag,
                recurrence_count=trend.seasonality.recurrence_count,
                avg_gap_runs=trend.seasonality.avg_gap_runs,
                confidence=trend.seasonality.confidence,
            )
            if trend.seasonality is not None
            else None
        ),
        forecast_direction=trend.forecast_direction,
    )


def serialize_detail_trend(trend: TrendDetailRecord) -> TrendDetailRecordPayload:
    """Convert an internal detail record into the public V2 contract."""

    return TrendDetailRecordPayload(
        id=trend.id,
        name=trend.name,
        category=trend.category,
        meta_trend=trend.meta_trend,
        stage=trend.stage,
        confidence=round(trend.confidence, 3),
        summary=trend.summary,
        why_now=trend.why_now,
        status=trend.status,
        volatility=trend.volatility,
        rank=trend.rank,
        previous_rank=trend.previous_rank,
        rank_change=trend.rank_change,
        first_seen_at=to_optional_timestamp(trend.first_seen_at),
        latest_signal_at=to_timestamp(trend.latest_signal_at),
        score=TrendScoreComponents(
            total=round(trend.score.total_score, 1),
            social=round(trend.score.social_score, 1),
            developer=round(trend.score.developer_score, 1),
            knowledge=round(trend.score.knowledge_score, 1),
            search=round(trend.score.search_score, 1),
            advertising=round(trend.score.advertising_score, 1),
            diversity=round(trend.score.diversity_score, 1),
        ),
        momentum=TrendMomentumPayload(
            previous_rank=trend.momentum.previous_rank,
            rank_change=trend.momentum.rank_change,
            absolute_delta=trend.momentum.absolute_delta,
            percent_delta=trend.momentum.percent_delta,
        ),
        breakout_prediction=BreakoutPredictionPayload(
            confidence=trend.breakout_prediction.confidence,
            predicted_direction=trend.breakout_prediction.predicted_direction,
            signals=trend.breakout_prediction.signals,
        ),
        forecast=(
            TrendForecastPayload(
                predicted_scores=[round(score, 2) for score in trend.forecast.predicted_scores],
                confidence=trend.forecast.confidence,
                mape=trend.forecast.mape,
                method=trend.forecast.method,
            )
            if trend.forecast is not None
            else None
        ),
        opportunity=OpportunityPayload(
            composite=trend.opportunity.composite,
            discovery=trend.opportunity.discovery,
            seo=trend.opportunity.seo,
            content=trend.opportunity.content,
            product=trend.opportunity.product,
            investment=trend.opportunity.investment,
            reasoning=trend.opportunity.reasoning,
        ),
        coverage=TrendCoveragePayload(
            source_count=trend.source_count,
            signal_count=trend.signal_count,
        ),
        sources=trend.sources,
        aliases=trend.aliases,
        history=[
            TrendHistoryPointPayload(
                captured_at=to_timestamp(point.captured_at),
                rank=point.rank,
                score_total=round(point.score_total, 1),
            )
            for point in trend.history
        ],
        source_breakdown=[
            TrendSourceBreakdownPayload(
                source=item.source,
                signal_count=item.signal_count,
                latest_signal_at=to_timestamp(item.latest_signal_at),
            )
            for item in trend.source_breakdown
        ],
        source_contributions=[
            TrendSourceContributionPayload(
                source=item.source,
                signal_count=item.signal_count,
                latest_signal_at=to_timestamp(item.latest_signal_at),
                estimated_score=round(item.estimated_score, 1),
                score_share_percent=item.score_share_percent,
                score=TrendScoreComponents(
                    total=round(item.estimated_score, 1),
                    social=round(item.social_score, 1),
                    developer=round(item.developer_score, 1),
                    knowledge=round(item.knowledge_score, 1),
                    search=round(item.search_score, 1),
                    advertising=round(item.advertising_score, 1),
                    diversity=round(item.diversity_score, 1),
                ),
            )
            for item in trend.source_contributions
        ],
        market_footprint=[
            TrendMarketMetricPayload(
                source=item.source,
                metric_key=item.metric_key,
                label=item.label,
                value_numeric=round(item.value_numeric, 2),
                value_display=item.value_display,
                unit=item.unit,
                period=item.period,
                captured_at=to_timestamp(item.captured_at),
                confidence=round(item.confidence, 2),
                provenance_url=item.provenance_url,
                is_estimated=item.is_estimated,
            )
            for item in trend.market_footprint
        ],
        geo_summary=[
            TrendGeoSummaryPayload(
                label=item.label,
                country_code=item.country_code,
                region=item.region,
                signal_count=item.signal_count,
                explicit_count=item.explicit_count,
                inferred_count=item.inferred_count,
                average_confidence=item.average_confidence,
            )
            for item in trend.geo_summary
        ],
        audience_summary=[
            TrendAudienceSegmentPayload(
                segment_type=item.segment_type,
                label=item.label,
                signal_count=item.signal_count,
            )
            for item in trend.audience_summary
        ],
        evidence_items=[
            TrendEvidenceItemPayload(
                source=item.source,
                signal_type=item.signal_type,
                timestamp=to_timestamp(item.timestamp),
                value=round(item.value, 1),
                evidence=item.evidence,
                evidence_url=item.evidence_url,
                language_code=item.language_code,
                audience_flags=list(item.audience_flags),
                market_flags=list(item.market_flags),
                geo_flags=list(item.geo_flags),
                geo_country_code=item.geo_country_code,
                geo_region=item.geo_region,
                geo_detection_mode=item.geo_detection_mode,
                geo_confidence=round(item.geo_confidence, 2),
            )
            for item in trend.evidence_items
        ],
        primary_evidence=(
            TrendPrimaryEvidencePayload(
                source=trend.primary_evidence.source,
                signal_type=trend.primary_evidence.signal_type,
                timestamp=to_timestamp(trend.primary_evidence.timestamp),
                value=round(trend.primary_evidence.value, 1),
                evidence=trend.primary_evidence.evidence,
                evidence_url=trend.primary_evidence.evidence_url,
            )
            if trend.primary_evidence is not None
            else None
        ),
        duplicate_candidates=[
            serialize_duplicate_candidate(item)
            for item in trend.duplicate_candidates
        ],
        related_trends=[
            serialize_related_trend(item)
            for item in trend.related_trends
        ],
        seasonality=(
            SeasonalityPayload(
                tag=trend.seasonality.tag,
                recurrence_count=trend.seasonality.recurrence_count,
                avg_gap_runs=trend.seasonality.avg_gap_runs,
                confidence=trend.seasonality.confidence,
            )
            if trend.seasonality is not None
            else None
        ),
        wikipedia_extract=trend.wikipedia_extract,
        wikipedia_description=trend.wikipedia_description,
        wikipedia_thumbnail_url=trend.wikipedia_thumbnail_url,
        wikipedia_page_url=trend.wikipedia_page_url,
    )


def serialize_related_trend(trend: RelatedTrend) -> RelatedTrendPayload:
    """Convert a related-trend recommendation into the public contract."""

    return RelatedTrendPayload(
        id=trend.id,
        name=trend.name,
        status=trend.status,
        rank=trend.rank,
        score_total=round(trend.score_total, 1),
        relationship_strength=round(trend.relationship_strength, 2),
    )


def serialize_duplicate_candidate(trend: TrendDuplicateCandidate) -> TrendDuplicateCandidatePayload:
    """Convert a duplicate-trend candidate into the public contract."""

    return TrendDuplicateCandidatePayload(
        id=trend.id,
        name=trend.name,
        similarity=round(trend.similarity, 2),
        reason=trend.reason,
    )


def to_timestamp(value: datetime) -> str:
    """Return a UTC ISO-8601 timestamp."""

    utc_value = value.astimezone(timezone.utc)
    return utc_value.isoformat().replace("+00:00", "Z")


def to_optional_timestamp(value: datetime | None) -> str | None:
    """Return a UTC timestamp or None."""

    if value is None:
        return None
    return to_timestamp(value)


def slugify(topic: str) -> str:
    """Convert a topic to a stable slug identifier."""

    normalized = re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")
    return normalized or "trend"


def build_source_summaries(
    signals: list[NormalizedSignal],
    source_runs: list[SourceIngestionRun],
) -> list[DashboardOverviewSourcePayload]:
    """Aggregate signal and topic counts by source."""

    source_map: dict[str, set[str]] = {}
    signal_counts: dict[str, int] = {}
    for signal in signals:
        signal_counts[signal.source] = signal_counts.get(signal.source, 0) + 1
        source_map.setdefault(signal.source, set()).add(signal.topic)

    latest_success_by_source: dict[str, SourceIngestionRun] = {}
    latest_by_source: dict[str, SourceIngestionRun] = {}
    for run in source_runs:
        latest_by_source[run.source] = run
        if run.success:
            latest_success_by_source[run.source] = run

    known_sources = set(signal_counts) | set(latest_by_source)

    return [
        DashboardOverviewSourcePayload(
            source=source,
            family=source_family_for_source(source),
            signal_count=signal_counts.get(source, 0),
            trend_count=len(source_map.get(source, set())),
            status=build_source_status(latest_by_source.get(source)),
            latest_fetch_at=(
                to_timestamp(latest_by_source[source].fetched_at)
                if source in latest_by_source
                else None
            ),
            latest_success_at=(
                to_timestamp(latest_success_by_source[source].fetched_at)
                if source in latest_success_by_source
                else None
            ),
            raw_item_count=latest_by_source[source].raw_item_count if source in latest_by_source else 0,
            latest_item_count=latest_by_source[source].item_count if source in latest_by_source else 0,
            kept_item_count=latest_by_source[source].kept_item_count if source in latest_by_source else 0,
            yield_rate_percent=build_yield_rate_percent(latest_by_source.get(source)),
            signal_yield_ratio=build_signal_yield_ratio(
                signal_counts.get(source, 0),
                latest_by_source.get(source),
            ),
            duration_ms=latest_by_source[source].duration_ms if source in latest_by_source else 0,
            raw_topic_count=latest_by_source[source].raw_topic_count if source in latest_by_source else 0,
            merged_topic_count=latest_by_source[source].merged_topic_count if source in latest_by_source else 0,
            duplicate_topic_count=latest_by_source[source].duplicate_topic_count if source in latest_by_source else 0,
            duplicate_topic_rate=latest_by_source[source].duplicate_topic_rate if source in latest_by_source else 0.0,
            used_fallback=latest_by_source[source].used_fallback if source in latest_by_source else False,
            error_message=latest_by_source[source].error_message if source in latest_by_source else None,
        )
        for source in sorted(known_sources, key=lambda item: (-signal_counts.get(item, 0), item))
    ]


def build_source_status(run: SourceIngestionRun | None) -> str:
    """Return the dashboard health label for a source."""

    if run is None or not run.success:
        return "stale"
    if run.used_fallback:
        return "degraded"
    return "healthy"


def build_yield_rate_percent(run: SourceIngestionRun | None) -> float:
    """Return the share of raw fetched items kept after dedupe and caps."""

    if run is None or run.raw_item_count <= 0:
        return 0.0
    return round((run.kept_item_count / run.raw_item_count) * 100, 1)


def build_signal_yield_ratio(signal_count: int, run: SourceIngestionRun | None) -> float:
    """Return how many normalized signals survive per kept source item."""

    if run is None or run.kept_item_count <= 0:
        return 0.0
    return round(signal_count / run.kept_item_count, 2)


def build_source_watch_records(sources: list[DashboardOverviewSourcePayload]) -> list[SourceWatchRecord]:
    """Derive compact operational warnings from source summaries."""

    watch_items: list[SourceWatchRecord] = []
    for source in sources:
        title = fallback_display_name(source.source.replace("_", " "))
        if source.error_message:
            watch_items.append(
                SourceWatchRecord(
                    source=source.source,
                    severity="critical",
                    title=title,
                    detail="Latest run failed",
                )
            )
            continue
        if source.used_fallback or source.status == "degraded":
            watch_items.append(
                SourceWatchRecord(
                    source=source.source,
                    severity="warning",
                    title=title,
                    detail="Latest run used fallback data",
                )
            )
            continue
        if source.status == "stale":
            watch_items.append(
                SourceWatchRecord(
                    source=source.source,
                    severity="warning",
                    title=title,
                    detail="No recent healthy run",
                )
            )
            continue
        if source.raw_item_count >= 10 and source.yield_rate_percent < 30:
            watch_items.append(
                SourceWatchRecord(
                    source=source.source,
                    severity="warning",
                    title=title,
                    detail="Low kept yield from recent fetches",
                )
            )
            continue
        if source.raw_item_count >= 10 and source.yield_rate_percent < 50:
            watch_items.append(
                SourceWatchRecord(
                    source=source.source,
                    severity="info",
                    title=title,
                    detail="Mixed kept yield from recent fetches",
                )
            )
    return sorted(
        watch_items,
        key=lambda item: (-source_watch_severity_weight(item.severity), item.source),
    )[:4]


def source_watch_severity_weight(severity: str) -> int:
    """Return a stable sort weight for operational source warnings."""

    if severity == "critical":
        return 3
    if severity == "warning":
        return 2
    return 1


def build_dashboard_charts_payload(
    trends: list[TrendDetailRecord],
    source_summaries: list[DashboardOverviewSourcePayload],
) -> DashboardOverviewChartsPayload:
    """Return compact chart datasets for the homepage."""

    status_counts: dict[str, int] = {}
    for trend in trends:
        status_counts[trend.status] = status_counts.get(trend.status, 0) + 1

    return DashboardOverviewChartsPayload(
        top_trend_scores=[
            DashboardOverviewChartDatumPayload(
                label=trend.name,
                value=round(trend.score.total_score, 1),
            )
            for trend in trends[:8]
        ],
        source_share=[
            DashboardOverviewChartDatumPayload(
                label=source.source.replace("_", " ").title(),
                value=float(source.signal_count),
            )
            for source in source_summaries
            if source.signal_count > 0
        ],
        status_breakdown=[
            DashboardOverviewChartDatumPayload(
                    label=fallback_display_name(status),
                value=float(count),
            )
            for status, count in sorted(status_counts.items(), key=lambda item: (-item[1], item[0]))
        ],
    )


def build_dashboard_sections_payload(
    trends: list[TrendDetailRecord],
    experimental_trends: list[TrendScoreResult],
) -> DashboardOverviewSectionsPayload:
    """Return curated overview sections similar to dedicated trend products."""

    return DashboardOverviewSectionsPayload(
        top_trends=[serialize_overview_trend_item(trend) for trend in trends[:5]],
        breakout_trends=[
            serialize_overview_trend_item(trend)
            for trend in trends
            if trend.status == "breakout"
        ][:5],
        rising_trends=[
            serialize_overview_trend_item(trend)
            for trend in trends
            if trend.status == "rising"
        ][:5],
        experimental_trends=[
            serialize_overview_experimental_item(score, rank_offset)
            for rank_offset, score in enumerate(experimental_trends, start=len(trends) + 1)
        ][:6],
        meta_trends=build_meta_trend_payloads(trends),
    )


def serialize_overview_trend_item(trend: TrendDetailRecord) -> DashboardOverviewTrendItemPayload:
    """Convert a detail record into a compact overview trend item."""

    return DashboardOverviewTrendItemPayload(
        id=trend.id,
        name=trend.name,
        category=trend.category,
        status=trend.status,
        rank=trend.rank,
        score_total=round(trend.score.total_score, 1),
    )


def serialize_overview_experimental_item(
    score: TrendScoreResult,
    rank: int,
) -> DashboardOverviewTrendItemPayload:
    """Convert an experimental score candidate into a compact overview item."""

    return DashboardOverviewTrendItemPayload(
        id=slugify(score.topic),
        name=score.display_name or build_display_name(score.topic, score.evidence),
        category=categorize_topic(score.topic, score.source_counts),
        status="experimental",
        rank=rank,
        score_total=round(score.total_score, 1),
    )


def build_meta_trend_payloads(trends: list[TrendDetailRecord]) -> list[DashboardOverviewMetaTrendPayload]:
    """Summarize the current ranked set into category-level meta trends."""

    grouped: dict[str, list[TrendDetailRecord]] = {}
    for trend in trends:
        grouped.setdefault(trend.category, []).append(trend)

    payloads = [
        # Top-ranked trend acts as the anchor label for each meta trend bucket.
        DashboardOverviewMetaTrendPayload(
            category=category,
            trend_count=len(items),
            average_score=round(sum(item.score.total_score for item in items) / len(items), 1),
            top_trend_id=sorted(items, key=lambda item: item.rank)[0].id,
            top_trend_name=sorted(items, key=lambda item: item.rank)[0].name,
        )
        for category, items in grouped.items()
    ]
    payloads.sort(key=lambda item: (-item.average_score, -item.trend_count, item.category))
    return payloads[:6]


def build_dashboard_operations_payload(
    pipeline_runs: list[PipelineRun],
) -> DashboardOverviewOperationsPayload:
    """Return recent operational history for full pipeline runs."""

    if not pipeline_runs:
        return DashboardOverviewOperationsPayload(
            last_run_at=None,
            success_rate=0.0,
            average_duration_ms=0,
            recent_runs=[],
        )

    healthy_runs = sum(1 for run in pipeline_runs if run.failed_source_count == 0)
    average_duration_ms = round(
        sum(run.duration_ms for run in pipeline_runs) / len(pipeline_runs)
    )
    return DashboardOverviewOperationsPayload(
        last_run_at=to_timestamp(pipeline_runs[0].captured_at),
        success_rate=round((healthy_runs / len(pipeline_runs)) * 100, 1),
        average_duration_ms=average_duration_ms,
        recent_runs=[
            DashboardOverviewRunPayload(
                captured_at=to_timestamp(run.captured_at),
                duration_ms=run.duration_ms,
                source_count=run.source_count,
                successful_source_count=run.successful_source_count,
                failed_source_count=run.failed_source_count,
                signal_count=run.signal_count,
                ranked_trend_count=run.ranked_trend_count,
                status="healthy" if run.failed_source_count == 0 else "degraded",
                top_trend_id=slugify(run.top_topic) if run.top_topic else None,
                top_trend_name=fallback_display_name(run.top_topic) if run.top_topic else None,
                top_score=round(run.top_score, 1) if run.top_score is not None else None,
                raw_topic_count=run.raw_topic_count,
                merged_topic_count=run.merged_topic_count,
                duplicate_topic_count=run.duplicate_topic_count,
                duplicate_topic_rate=run.duplicate_topic_rate,
                multi_source_trend_count=run.multi_source_trend_count,
                low_evidence_trend_count=run.low_evidence_trend_count,
            )
            for run in pipeline_runs
        ],
    )


def build_source_summary_records(
    trends: list[TrendDetailRecord],
    signals: list[NormalizedSignal],
    latest_source_runs: list[SourceIngestionRun],
    source_run_history: dict[str, list[SourceIngestionRun]],
) -> list[SourceSummaryRecord]:
    """Build detailed source summaries from trend and ingestion state."""

    signal_counts: dict[str, int] = {}
    trend_counts: dict[str, set[str]] = {}
    for signal in signals:
        signal_counts[signal.source] = signal_counts.get(signal.source, 0) + 1
        trend_counts.setdefault(signal.source, set()).add(signal.topic)

    trends_by_source: dict[str, list[SourceSummaryTrend]] = {}
    for trend in trends:
        for source in trend.sources:
            trends_by_source.setdefault(source, []).append(
                SourceSummaryTrend(
                    id=trend.id,
                    name=trend.name,
                    rank=trend.rank,
                    score_total=round(trend.score.total_score, 1),
                )
            )

    latest_run_map = {run.source: run for run in latest_source_runs}
    known_sources = set(signal_counts) | set(latest_run_map) | set(trends_by_source) | set(source_run_history)
    summaries: list[SourceSummaryRecord] = []
    for source in sorted(known_sources):
        latest_run = latest_run_map.get(source)
        successful_runs = [run for run in source_run_history.get(source, []) if run.success]
        summaries.append(
            SourceSummaryRecord(
                source=source,
                family=source_family_for_source(source),
                status=build_source_status(latest_run),
                latest_fetch_at=latest_run.fetched_at if latest_run is not None else None,
                latest_success_at=successful_runs[0].fetched_at if successful_runs else None,
                raw_item_count=latest_run.raw_item_count if latest_run is not None else 0,
                latest_item_count=latest_run.item_count if latest_run is not None else 0,
                kept_item_count=latest_run.kept_item_count if latest_run is not None else 0,
                yield_rate_percent=build_yield_rate_percent(latest_run),
                signal_yield_ratio=build_signal_yield_ratio(signal_counts.get(source, 0), latest_run),
                duration_ms=latest_run.duration_ms if latest_run is not None else 0,
                raw_topic_count=latest_run.raw_topic_count if latest_run is not None else 0,
                merged_topic_count=latest_run.merged_topic_count if latest_run is not None else 0,
                duplicate_topic_count=latest_run.duplicate_topic_count if latest_run is not None else 0,
                duplicate_topic_rate=latest_run.duplicate_topic_rate if latest_run is not None else 0.0,
                used_fallback=latest_run.used_fallback if latest_run is not None else False,
                error_message=latest_run.error_message if latest_run is not None else None,
                signal_count=signal_counts.get(source, 0),
                trend_count=len(trend_counts.get(source, set())),
                run_history=source_run_history.get(source, []),
                top_trends=sorted(
                    trends_by_source.get(source, []),
                    key=lambda trend: (trend.rank, -trend.score_total, trend.name),
                )[:5],
            )
        )
    return summaries


def build_ad_intelligence_payload(
    generated_at: datetime,
    signals: list[NormalizedSignal],
) -> AdIntelligencePayload:
    """Create the ad intelligence payload from ingested signals."""

    from app.sources.catalog import source_family_for_source

    keyword_stats: dict[str, dict[str, object]] = {}
    advertiser_stats: dict[tuple[str, str], dict[str, object]] = {}
    platform_stats: dict[str, dict[str, set[str]]] = {}

    for signal in signals:
        family = source_family_for_source(signal.source)
        if family != "advertising":
            continue
        topic = signal.topic
        if topic not in keyword_stats:
            keyword_stats[topic] = {
                "keyword": topic,
                "cpc": 0.0,
                "search_volume": 0,
                "competition_level": "unknown",
                "ad_density": 0.0,
                "platforms": set(),
                "top_advertisers": set(),
                "trend_id": slugify(topic),
            }
        keyword_stats[topic]["platforms"].add(signal.source)
        keyword_stats[topic]["ad_density"] = max(
            keyword_stats[topic]["ad_density"],
            signal.value,
        )

        platform = signal.source
        if platform not in platform_stats:
            platform_stats[platform] = {
                "keywords": set(),
                "advertisers": set(),
                "ad_count": 0,
            }
        platform_stats[platform]["keywords"].add(topic)
        platform_stats[platform]["ad_count"] += 1

    top_keywords = sorted(
        keyword_stats.values(),
        key=lambda kw: (-kw["ad_density"], kw["keyword"]),
    )[:20]

    keyword_payloads = [
        AdIntelligenceKeywordPayload(
            keyword=kw["keyword"],
            cpc=kw["cpc"],
            search_volume=kw["search_volume"],
            competition_level=kw["competition_level"],
            ad_density=round(kw["ad_density"], 2),
            platforms=sorted(kw["platforms"]),
            top_advertisers=sorted(kw["top_advertisers"]),
            trend_id=kw["trend_id"],
        )
        for kw in top_keywords
    ]

    advertiser_payloads: list[AdIntelligenceAdvertiserPayload] = []

    platform_payloads = [
        AdIntelligencePlatformSummaryPayload(
            platform=platform,
            ad_count=stats["ad_count"],
            keyword_count=len(stats["keywords"]),
            advertiser_count=len(stats["advertisers"]),
        )
        for platform, stats in sorted(
            platform_stats.items(),
            key=lambda item: (-item[1]["ad_count"], item[0]),
        )
    ]

    return AdIntelligencePayload(
        generated_at=to_timestamp(generated_at),
        top_keywords=keyword_payloads,
        top_advertisers=advertiser_payloads,
        platform_summary=platform_payloads,
    )
