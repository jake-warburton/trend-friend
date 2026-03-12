"""Shared data models used across the application."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class RawSourceItem:
    """A normalized external content item before topic extraction."""

    source: str
    external_id: str
    title: str
    url: str
    timestamp: datetime
    engagement_score: float
    metadata: dict[str, str] = field(default_factory=dict)
    geo_flags: tuple[str, ...] = ()
    geo_country_code: str | None = None
    geo_region: str | None = None
    geo_detection_mode: str = "unknown"
    geo_confidence: float = 0.0


@dataclass(frozen=True)
class NormalizedSignal:
    """A topic-level signal derived from a source item."""

    topic: str
    source: str
    signal_type: str
    value: float
    timestamp: datetime
    evidence: str
    evidence_url: str | None = None
    language_code: str | None = None
    audience_flags: tuple[str, ...] = ()
    market_flags: tuple[str, ...] = ()
    geo_flags: tuple[str, ...] = ()
    geo_country_code: str | None = None
    geo_region: str | None = None
    geo_detection_mode: str = "unknown"
    geo_confidence: float = 0.0


@dataclass(frozen=True)
class SourceIngestionRun:
    """Fetch result for a single source during a pipeline run."""

    source: str
    fetched_at: datetime
    success: bool
    raw_item_count: int
    item_count: int
    kept_item_count: int
    duration_ms: int
    used_fallback: bool = False
    error_message: str | None = None


@dataclass(frozen=True)
class TopicAggregate:
    """Aggregated metrics for a topic across many signals."""

    topic: str
    source_counts: dict[str, int]
    signal_counts: dict[str, int]
    total_signal_value: float
    average_signal_value: float
    latest_timestamp: datetime
    evidence: list[str]
    display_name: str | None = None


@dataclass(frozen=True)
class TrendScoreResult:
    """Explainable trend score output for a topic."""

    topic: str
    total_score: float
    search_score: float
    social_score: float
    developer_score: float
    knowledge_score: float
    diversity_score: float
    evidence: list[str]
    source_counts: dict[str, int]
    latest_timestamp: datetime
    display_name: str | None = None


@dataclass(frozen=True)
class TrendHistoryPoint:
    """Historical position and score for a topic at a specific run."""

    captured_at: datetime
    rank: int
    score_total: float


@dataclass(frozen=True)
class TrendMomentum:
    """Movement metrics derived from the most recent historical snapshots."""

    previous_rank: int | None
    rank_change: int | None
    absolute_delta: float | None
    percent_delta: float | None


@dataclass(frozen=True)
class BreakoutPredictionSummary:
    """Compact breakout prediction data for a trend."""

    confidence: float
    predicted_direction: str
    signals: list[str]


@dataclass(frozen=True)
class TrendForecast:
    """Short-horizon score projection derived from recent history."""

    predicted_scores: list[float]
    confidence: str
    mape: float
    method: str


@dataclass(frozen=True)
class SeasonalityResult:
    """Derived recurrence metadata for a trend."""

    tag: str | None
    recurrence_count: int
    avg_gap_runs: float
    confidence: float


@dataclass(frozen=True)
class OpportunitySummary:
    """Actionability scoring for a trend."""

    composite: float
    content: float
    product: float
    investment: float
    reasoning: list[str]


@dataclass(frozen=True)
class TrendExplorerRecord:
    """Richer read model for the explorer dashboard."""

    id: str
    name: str
    category: str
    status: str
    volatility: str
    rank: int
    previous_rank: int | None
    rank_change: int | None
    first_seen_at: datetime | None
    latest_signal_at: datetime
    score: TrendScoreResult
    momentum: TrendMomentum
    source_count: int
    signal_count: int
    recent_history: list[TrendHistoryPoint]
    audience_summary: list["TrendAudienceSegment"] = field(default_factory=list)
    primary_evidence: "TrendPrimaryEvidence | None" = None
    seasonality: SeasonalityResult | None = None
    forecast_direction: str | None = None


@dataclass(frozen=True)
class TrendSourceBreakdown:
    """Source-level coverage details for a trend."""

    source: str
    signal_count: int
    latest_signal_at: datetime


@dataclass(frozen=True)
class TrendSourceContribution:
    """Estimated contribution of one source to a trend's score."""

    source: str
    signal_count: int
    latest_signal_at: datetime
    estimated_score: float
    score_share_percent: float
    social_score: float
    developer_score: float
    knowledge_score: float
    search_score: float
    diversity_score: float


@dataclass(frozen=True)
class TrendEvidenceItem:
    """Evidence item captured from a normalized signal."""

    source: str
    signal_type: str
    timestamp: datetime
    value: float
    evidence: str
    evidence_url: str | None = None
    language_code: str | None = None
    audience_flags: tuple[str, ...] = ()
    market_flags: tuple[str, ...] = ()
    geo_flags: tuple[str, ...] = ()
    geo_country_code: str | None = None
    geo_region: str | None = None
    geo_detection_mode: str = "unknown"
    geo_confidence: float = 0.0


@dataclass(frozen=True)
class TrendPrimaryEvidence:
    """Best explanatory linked evidence item for a trend."""

    source: str
    signal_type: str
    timestamp: datetime
    value: float
    evidence: str
    evidence_url: str


@dataclass(frozen=True)
class TrendGeoSummary:
    """Aggregated location coverage for a trend."""

    label: str
    country_code: str | None
    region: str | None
    signal_count: int
    explicit_count: int
    inferred_count: int
    average_confidence: float


@dataclass(frozen=True)
class TrendAudienceSegment:
    """Aggregated audience or market segment coverage for a trend."""

    segment_type: str
    label: str
    signal_count: int


@dataclass(frozen=True)
class RelatedTrend:
    """Compact related-trend recommendation."""

    id: str
    name: str
    status: str
    rank: int
    score_total: float


@dataclass(frozen=True)
class TrendDetailRecord:
    """Detailed read model for a single trend page."""

    id: str
    name: str
    category: str
    status: str
    volatility: str
    rank: int
    previous_rank: int | None
    rank_change: int | None
    first_seen_at: datetime | None
    latest_signal_at: datetime
    score: TrendScoreResult
    momentum: TrendMomentum
    breakout_prediction: BreakoutPredictionSummary
    forecast: TrendForecast | None
    opportunity: OpportunitySummary
    source_count: int
    signal_count: int
    sources: list[str]
    history: list[TrendHistoryPoint]
    source_breakdown: list[TrendSourceBreakdown]
    source_contributions: list[TrendSourceContribution]
    geo_summary: list[TrendGeoSummary]
    audience_summary: list[TrendAudienceSegment]
    evidence_items: list[TrendEvidenceItem]
    primary_evidence: TrendPrimaryEvidence | None
    related_trends: list[RelatedTrend]
    seasonality: SeasonalityResult | None = None


@dataclass(frozen=True)
class SourceSummaryTrend:
    """Trend summary associated with a source."""

    id: str
    name: str
    rank: int
    score_total: float


@dataclass(frozen=True)
class SourceSummaryRecord:
    """Detailed source health and contribution summary."""

    source: str
    status: str
    latest_fetch_at: datetime | None
    latest_success_at: datetime | None
    raw_item_count: int
    latest_item_count: int
    kept_item_count: int
    yield_rate_percent: float
    duration_ms: int
    used_fallback: bool
    error_message: str | None
    signal_count: int
    trend_count: int
    run_history: list[SourceIngestionRun]
    top_trends: list[SourceSummaryTrend]


@dataclass(frozen=True)
class SourceWatchRecord:
    """Operational warning or advisory derived from recent source behavior."""

    source: str
    severity: str
    title: str
    detail: str


@dataclass(frozen=True)
class PipelineRun:
    """Operational summary for a full pipeline execution."""

    captured_at: datetime
    duration_ms: int
    source_count: int
    successful_source_count: int
    failed_source_count: int
    signal_count: int
    ranked_trend_count: int
    top_topic: str | None
    top_score: float | None


@dataclass(frozen=True)
class WatchlistItem:
    """Tracked trend saved under a watchlist."""

    trend_id: str
    trend_name: str
    added_at: datetime


@dataclass(frozen=True)
class Watchlist:
    """Named collection of tracked trends."""

    id: int
    name: str
    owner_user_id: int | None
    default_share_duration_days: int | None
    created_at: datetime
    updated_at: datetime
    items: list[WatchlistItem]


@dataclass(frozen=True)
class WatchlistShare:
    """Public or token-based share link for a watchlist."""

    id: int
    watchlist_id: int
    share_token: str
    created_by: int | None
    is_public: bool
    show_creator: bool
    expires_at: datetime | None
    access_count: int
    last_accessed_at: datetime | None
    created_at: datetime


@dataclass(frozen=True)
class WatchlistShareEvent:
    """Audit event for a watchlist share lifecycle change."""

    id: int
    share_id: int | None
    watchlist_id: int
    actor_user_id: int | None
    event_type: str
    detail: str
    created_at: datetime


@dataclass(frozen=True)
class WatchlistShareAccessPoint:
    """Daily access count for a share link."""

    access_date: datetime
    access_count: int


@dataclass(frozen=True)
class AlertRule:
    """Simple alert condition attached to a watchlist."""

    id: int
    watchlist_id: int
    name: str
    rule_type: str
    threshold: float
    enabled: bool
    created_at: datetime


@dataclass(frozen=True)
class AlertEventRecord:
    """Persisted alert event from a triggered rule."""

    id: int
    rule_id: int
    watchlist_id: int
    trend_id: str
    trend_name: str
    rule_type: str
    threshold: float
    current_value: float
    message: str
    triggered_at: datetime
    read: bool


@dataclass(frozen=True)
class NotificationChannel:
    """Configured outbound notification destination."""

    id: int
    owner_user_id: int | None
    channel_type: str
    destination: str
    label: str
    enabled: bool
    created_at: datetime


@dataclass(frozen=True)
class NotificationLogEntry:
    """One attempted notification delivery."""

    id: int
    channel_id: int
    sent_at: datetime
    payload_json: str
    status_code: int | None
    error: str | None


@dataclass(frozen=True)
class DigestMover:
    """One rank mover included in a post-run digest."""

    name: str
    rank_change: int
    score: float


@dataclass(frozen=True)
class RunDigest:
    """High-signal summary of a completed ranking run."""

    total_trends: int
    new_entries: list[str]
    biggest_movers: list[DigestMover]
    breakouts: list[str]


@dataclass(frozen=True)
class User:
    """Registered user account."""

    id: int
    username: str
    password_hash: str
    display_name: str
    is_admin: bool
    created_at: datetime


@dataclass(frozen=True)
class ApiKey:
    """API key for programmatic access."""

    id: int
    user_id: int
    key_hash: str
    key_prefix: str
    name: str
    created_at: datetime
    last_used_at: datetime | None
    revoked: bool


@dataclass(frozen=True)
class UserSession:
    """Session token persisted for browser-backed authentication."""

    id: int
    user_id: int
    token_hash: str
    created_at: datetime
    last_used_at: datetime | None
    revoked: bool
