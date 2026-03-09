"""Frontend-facing data contracts."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class TrendScoreComponents:
    """Public score breakdown for a trend."""

    total: float
    social: float
    developer: float
    knowledge: float
    search: float
    diversity: float


@dataclass(frozen=True)
class TrendRecord:
    """Public trend record consumed by the web app."""

    id: str
    name: str
    rank: int
    score: TrendScoreComponents
    sources: list[str]
    evidence: list[str]
    latest_signal_at: str


@dataclass(frozen=True)
class LatestTrendsPayload:
    """Latest trend snapshot payload."""

    generated_at: str
    trends: list[TrendRecord]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""

        return {
            "generatedAt": self.generated_at,
            "trends": [trend_to_dict(trend) for trend in self.trends],
        }


@dataclass(frozen=True)
class TrendSnapshotPayload:
    """Historical snapshot payload."""

    captured_at: str
    trends: list[TrendRecord]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""

        return {
            "capturedAt": self.captured_at,
            "trends": [trend_to_dict(trend) for trend in self.trends],
        }


@dataclass(frozen=True)
class TrendHistoryPayload:
    """Historical trend response."""

    generated_at: str
    snapshots: list[TrendSnapshotPayload]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""

        return {
            "generatedAt": self.generated_at,
            "snapshots": [snapshot.to_dict() for snapshot in self.snapshots],
        }


@dataclass(frozen=True)
class TrendMomentumPayload:
    """Public movement metrics for a trend."""

    previous_rank: int | None
    rank_change: int | None
    absolute_delta: float | None
    percent_delta: float | None


@dataclass(frozen=True)
class TrendCoveragePayload:
    """Public coverage metrics for a trend."""

    source_count: int
    signal_count: int


@dataclass(frozen=True)
class TrendExplorerRecordPayload:
    """Public explorer record consumed by the dashboard V2."""

    id: str
    name: str
    rank: int
    previous_rank: int | None
    rank_change: int | None
    first_seen_at: str | None
    latest_signal_at: str
    score: TrendScoreComponents
    momentum: TrendMomentumPayload
    coverage: TrendCoveragePayload
    sources: list[str]
    evidence_preview: list[str]


@dataclass(frozen=True)
class TrendExplorerPayload:
    """Explorer response for Dashboard V2."""

    generated_at: str
    trends: list[TrendExplorerRecordPayload]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dictionary with API-style keys."""

        return {
            "generatedAt": self.generated_at,
            "trends": [trend_explorer_record_to_dict(trend) for trend in self.trends],
        }


def trend_to_dict(trend: TrendRecord) -> dict[str, object]:
    """Serialize a trend record using API-style keys."""

    payload = asdict(trend)
    payload["latestSignalAt"] = payload.pop("latest_signal_at")
    return payload


def trend_explorer_record_to_dict(trend: TrendExplorerRecordPayload) -> dict[str, object]:
    """Serialize an explorer record using API-style keys."""

    payload = asdict(trend)
    payload["previousRank"] = payload.pop("previous_rank")
    payload["rankChange"] = payload.pop("rank_change")
    payload["firstSeenAt"] = payload.pop("first_seen_at")
    payload["latestSignalAt"] = payload.pop("latest_signal_at")
    return payload
