"""Tests for web export payload generation."""

from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

from app.exports.files import write_export_payloads
from app.exports.serializers import (
    build_dashboard_overview_payload,
    build_source_summary_payload,
    build_source_summary_records,
    build_trend_detail_index_payload,
    build_latest_trends_payload,
    build_trend_explorer_payload,
    build_trend_history_payload,
)
from app.models import (
    BreakoutPredictionSummary,
    TrendAudienceSegment,
    SeasonalityResult,
    TrendDetailRecord,
    TrendEvidenceItem,
    TrendExplorerRecord,
    TrendForecast,
    TrendGeoSummary,
    TrendHistoryPoint,
    TrendMomentum,
    TrendMetricSnapshot,
    TrendPrimaryEvidence,
    NormalizedSignal,
    OpportunitySummary,
    PipelineRun,
    RelatedTrend,
    TrendDuplicateCandidate,
    SourceIngestionRun,
    SourceSummaryRecord,
    SourceSummaryTrend,
    TrendScoreResult,
    TrendSourceContribution,
    TrendSourceBreakdown,
)


class ExportPayloadTests(unittest.TestCase):
    """Web export payloads should remain stable and JSON-serializable."""

    def setUp(self) -> None:
        self.export_directory = Path("data/test-web-exports")
        if self.export_directory.exists():
            for path in self.export_directory.iterdir():
                path.unlink()
            self.export_directory.rmdir()

    def tearDown(self) -> None:
        if self.export_directory.exists():
            for path in self.export_directory.iterdir():
                path.unlink()
            self.export_directory.rmdir()

    def test_build_latest_trends_payload_uses_api_style_keys(self) -> None:
        generated_at = datetime(2026, 3, 9, 21, 8, 16, tzinfo=timezone.utc)
        score = build_score("ai agents")
        payload = build_latest_trends_payload(generated_at=generated_at, scores=[score]).to_dict()
        self.assertEqual(payload["generatedAt"], "2026-03-09T21:08:16Z")
        self.assertEqual(payload["trends"][0]["id"], "ai-agents")
        self.assertEqual(payload["trends"][0]["name"], "AI Agents")
        self.assertEqual(payload["trends"][0]["latestSignalAt"], "2026-03-08T00:00:00Z")

    def test_build_latest_trends_payload_prefers_preserved_display_name(self) -> None:
        generated_at = datetime(2026, 3, 9, 21, 8, 16, tzinfo=timezone.utc)
        score = build_score("macbook neo", display_name="MacBook NEO")
        payload = build_latest_trends_payload(generated_at=generated_at, scores=[score]).to_dict()
        self.assertEqual(payload["trends"][0]["name"], "MacBook NEO")

    def test_write_export_payloads_writes_latest_and_history_files(self) -> None:
        generated_at = datetime(2026, 3, 9, 21, 8, 16, tzinfo=timezone.utc)
        latest_payload = build_latest_trends_payload(generated_at=generated_at, scores=[build_score("ai agents")])
        history_payload = build_trend_history_payload(
            generated_at=generated_at,
            snapshots=[(generated_at, [build_score("battery recycling")])],
        )
        explorer_payload = build_trend_explorer_payload(
            generated_at=generated_at,
            trends=[build_explorer_record("ai agents")],
        )
        detail_payload = build_trend_detail_index_payload(
            generated_at=generated_at,
            trends=[build_detail_record("ai agents")],
        )
        overview_payload = build_dashboard_overview_payload(
            generated_at=generated_at,
            trends=[build_detail_record("ai agents")],
            experimental_trends=[build_score("experimental ai")],
            signals=[
                build_signal("ai agents", "reddit", "social", 12.0),
                build_signal("ai agents", "github", "developer", 8.0),
            ],
            source_runs=[
                build_source_run("reddit", True, 3, duration_ms=120),
                build_source_run("github", False, 0, duration_ms=920, error_message="timeout"),
            ],
            pipeline_runs=[build_pipeline_run()],
        )
        source_summary_payload = build_source_summary_payload(
            generated_at=generated_at,
            sources=[
                build_source_summary_record("reddit"),
            ],
        )
        write_export_payloads(
            self.export_directory,
            latest_payload,
            history_payload,
            overview_payload,
            explorer_payload,
            detail_payload,
            source_summary_payload,
        )
        latest_data = json.loads((self.export_directory / "latest-trends.json").read_text(encoding="utf-8"))
        history_data = json.loads((self.export_directory / "trend-history.json").read_text(encoding="utf-8"))
        overview_data = json.loads((self.export_directory / "dashboard-overview.v2.json").read_text(encoding="utf-8"))
        explorer_data = json.loads((self.export_directory / "trend-explorer.v2.json").read_text(encoding="utf-8"))
        detail_data = json.loads((self.export_directory / "trend-detail-index.v2.json").read_text(encoding="utf-8"))
        source_summary_data = json.loads((self.export_directory / "source-summary.v2.json").read_text(encoding="utf-8"))
        self.assertEqual(latest_data["trends"][0]["name"], "AI Agents")
        self.assertEqual(history_data["snapshots"][0]["trends"][0]["name"], "Battery Recycling")
        self.assertEqual(overview_data["summary"]["trackedTrends"], 1)
        self.assertEqual(overview_data["charts"]["topTrendScores"][0]["label"], "AI Agents")
        self.assertEqual(overview_data["sections"]["topTrends"][0]["scoreTotal"], 42.4)
        self.assertEqual(overview_data["sections"]["experimentalTrends"][0]["name"], "Experimental AI")
        self.assertEqual(overview_data["sourceWatch"][0]["source"], "github")
        self.assertEqual(explorer_data["trends"][0]["previousRank"], 4)
        self.assertEqual(detail_data["trends"][0]["sourceBreakdown"][0]["latestSignalAt"], "2026-03-08T00:00:00Z")
        self.assertEqual(source_summary_data["sources"][0]["runHistory"][0]["durationMs"], 120)

    def test_build_trend_explorer_payload_uses_api_style_keys(self) -> None:
        generated_at = datetime(2026, 3, 9, 21, 8, 16, tzinfo=timezone.utc)
        payload = build_trend_explorer_payload(
            generated_at=generated_at,
            trends=[build_explorer_record("ai agents")],
        ).to_dict()
        self.assertEqual(payload["generatedAt"], "2026-03-09T21:08:16Z")
        self.assertEqual(payload["trends"][0]["id"], "ai-agents")
        self.assertEqual(payload["trends"][0]["status"], "breakout")
        self.assertEqual(payload["trends"][0]["category"], "artificial-intelligence")
        self.assertEqual(payload["trends"][0]["metaTrend"], "AI and automation")
        self.assertEqual(payload["trends"][0]["stage"], "breakout")
        self.assertEqual(payload["trends"][0]["confidence"], 0.86)
        self.assertIn("AI Agents is a breakout", payload["trends"][0]["summary"])
        self.assertEqual(payload["trends"][0]["volatility"], "spiking")
        self.assertEqual(payload["trends"][0]["previousRank"], 4)
        self.assertEqual(payload["trends"][0]["rankChange"], 3)
        self.assertEqual(payload["trends"][0]["firstSeenAt"], "2026-03-01T00:00:00Z")
        self.assertEqual(payload["trends"][0]["momentum"]["percentDelta"], 40.2)
        self.assertEqual(payload["trends"][0]["coverage"]["signalCount"], 2)
        self.assertEqual(payload["trends"][0]["evidencePreview"][0], "ai agents evidence")
        self.assertEqual(payload["trends"][0]["audienceSummary"][0]["segmentType"], "audience")
        self.assertEqual(payload["trends"][0]["audienceSummary"][0]["label"], "developer")
        self.assertEqual(payload["trends"][0]["primaryEvidence"]["source"], "reddit")
        self.assertEqual(payload["trends"][0]["primaryEvidence"]["evidenceUrl"], "https://example.com/ai-agents")
        self.assertEqual(payload["trends"][0]["seasonality"]["tag"], "recurring")
        self.assertEqual(payload["trends"][0]["seasonality"]["recurrenceCount"], 2)
        self.assertEqual(payload["trends"][0]["forecastDirection"], "accelerating")

    def test_build_trend_detail_index_payload_uses_api_style_keys(self) -> None:
        generated_at = datetime(2026, 3, 9, 21, 8, 16, tzinfo=timezone.utc)
        payload = build_trend_detail_index_payload(
            generated_at=generated_at,
            trends=[build_detail_record("ai agents")],
        ).to_dict()
        self.assertEqual(payload["generatedAt"], "2026-03-09T21:08:16Z")
        self.assertEqual(payload["trends"][0]["status"], "breakout")
        self.assertEqual(payload["trends"][0]["category"], "artificial-intelligence")
        self.assertEqual(payload["trends"][0]["metaTrend"], "AI and automation")
        self.assertEqual(payload["trends"][0]["stage"], "breakout")
        self.assertEqual(payload["trends"][0]["confidence"], 0.86)
        self.assertIn("AI Agents is a breakout", payload["trends"][0]["summary"])
        self.assertIn("Cross-source confirmation", payload["trends"][0]["whyNow"][1])
        self.assertEqual(payload["trends"][0]["volatility"], "spiking")
        self.assertEqual(payload["trends"][0]["history"][0]["capturedAt"], "2026-03-07T00:00:00Z")
        self.assertEqual(payload["trends"][0]["history"][0]["scoreTotal"], 20.4)
        self.assertEqual(payload["trends"][0]["geoSummary"][0]["countryCode"], "US")
        self.assertEqual(payload["trends"][0]["geoSummary"][0]["signalCount"], 1)
        self.assertEqual(payload["trends"][0]["audienceSummary"][0]["segmentType"], "audience")
        self.assertEqual(payload["trends"][0]["audienceSummary"][0]["label"], "developer")
        self.assertEqual(payload["trends"][0]["evidenceItems"][0]["signalType"], "social")
        self.assertEqual(payload["trends"][0]["evidenceItems"][0]["evidenceUrl"], "https://example.com/ai-agents")
        self.assertEqual(payload["trends"][0]["evidenceItems"][0]["languageCode"], "en")
        self.assertIn("developer", payload["trends"][0]["evidenceItems"][0]["audienceFlags"])
        self.assertEqual(payload["trends"][0]["primaryEvidence"]["evidenceUrl"], "https://example.com/ai-agents")
        self.assertEqual(payload["trends"][0]["evidenceItems"][0]["geoCountryCode"], "US")
        self.assertIn("geo:explicit", payload["trends"][0]["evidenceItems"][0]["geoFlags"])
        self.assertEqual(payload["trends"][0]["coverage"]["signalCount"], 2)
        self.assertEqual(payload["trends"][0]["breakoutPrediction"]["predictedDirection"], "breakout")
        self.assertEqual(payload["trends"][0]["forecast"]["method"], "holt")
        self.assertEqual(payload["trends"][0]["forecast"]["confidence"], "high")
        self.assertEqual(payload["trends"][0]["forecast"]["predictedScores"][0], 47.2)
        self.assertEqual(payload["trends"][0]["seasonality"]["tag"], "recurring")
        self.assertEqual(payload["trends"][0]["seasonality"]["avgGapRuns"], 3.5)
        self.assertGreater(payload["trends"][0]["opportunity"]["composite"], 0.0)
        self.assertEqual(payload["trends"][0]["opportunity"]["discovery"], 0.67)
        self.assertEqual(payload["trends"][0]["opportunity"]["seo"], 0.64)
        self.assertEqual(payload["trends"][0]["sourceBreakdown"][0]["signalCount"], 1)
        self.assertEqual(payload["trends"][0]["sourceContributions"][0]["estimatedScore"], 24.1)
        self.assertEqual(payload["trends"][0]["sourceContributions"][0]["scoreSharePercent"], 57.1)
        self.assertEqual(payload["trends"][0]["sourceContributions"][0]["score"]["social"], 18.2)
        self.assertEqual(payload["trends"][0]["marketFootprint"][0]["metricKey"], "search_traffic")
        self.assertEqual(payload["trends"][0]["marketFootprint"][0]["valueDisplay"], "2.4M")
        self.assertEqual(payload["trends"][0]["marketFootprint"][0]["provenanceUrl"], "https://trends.google.com/example")
        self.assertEqual(payload["trends"][0]["relatedTrends"][0]["scoreTotal"], 28.1)
        self.assertEqual(payload["trends"][0]["relatedTrends"][0]["relationshipStrength"], 0.8)
        self.assertEqual(payload["trends"][0]["duplicateCandidates"][0]["id"], "ai-agent")
        self.assertGreater(payload["trends"][0]["duplicateCandidates"][0]["similarity"], 0.6)
        self.assertIn("ai agents", payload["trends"][0]["aliases"])

    def test_build_dashboard_overview_payload_uses_api_style_keys(self) -> None:
        generated_at = datetime(2026, 3, 9, 21, 8, 16, tzinfo=timezone.utc)
        payload = build_dashboard_overview_payload(
            generated_at=generated_at,
            trends=[build_detail_record("ai agents")],
            experimental_trends=[build_score("experimental ai")],
            signals=[
                build_signal("ai agents", "reddit", "social", 12.0),
                build_signal("battery recycling", "reddit", "social", 10.0),
                build_signal("ai agents", "github", "developer", 8.0),
            ],
            source_runs=[
                build_source_run("reddit", True, 2, duration_ms=100),
                build_source_run("github", True, 2, duration_ms=85, used_fallback=True),
            ],
            pipeline_runs=[build_pipeline_run()],
        ).to_dict()
        self.assertEqual(payload["generatedAt"], "2026-03-09T21:08:16Z")
        self.assertEqual(payload["summary"]["totalSignals"], 3)
        self.assertEqual(payload["summary"]["sourceCount"], 2)
        self.assertEqual(payload["highlights"]["topTrendName"], "AI Agents")
        self.assertEqual(payload["operations"]["successRate"], 100.0)
        self.assertEqual(payload["operations"]["recentRuns"][0]["topTrendName"], "AI Agents")
        self.assertEqual(payload["charts"]["sourceShare"][0]["label"], "Reddit")
        self.assertEqual(payload["charts"]["statusBreakdown"][0]["label"], "Breakout")
        self.assertEqual(payload["sections"]["topTrends"][0]["name"], "AI Agents")
        self.assertEqual(payload["sections"]["experimentalTrends"][0]["status"], "experimental")
        self.assertEqual(payload["sections"]["metaTrends"][0]["category"], "artificial-intelligence")
        self.assertEqual(payload["sourceWatch"][0]["source"], "github")
        self.assertEqual(payload["sourceWatch"][0]["detail"], "Latest run used fallback data")
        self.assertEqual(payload["sources"][0]["signalCount"], 2)
        self.assertEqual(payload["sources"][0]["trendCount"], 2)
        self.assertEqual(payload["sources"][0]["rawItemCount"], 2)
        self.assertEqual(payload["sources"][0]["status"], "healthy")
        self.assertEqual(payload["sources"][1]["status"], "degraded")
        self.assertEqual(payload["sources"][1]["keptItemCount"], 2)
        self.assertEqual(payload["sources"][1]["yieldRatePercent"], 100.0)
        self.assertEqual(payload["sources"][1]["signalYieldRatio"], 0.5)
        self.assertTrue(payload["sources"][1]["usedFallback"])
        self.assertEqual(payload["sources"][1]["durationMs"], 85)

    def test_build_dashboard_overview_payload_marks_failed_sources_stale(self) -> None:
        generated_at = datetime(2026, 3, 9, 21, 8, 16, tzinfo=timezone.utc)
        payload = build_dashboard_overview_payload(
            generated_at=generated_at,
            trends=[build_detail_record("ai agents")],
            experimental_trends=[],
            signals=[build_signal("ai agents", "reddit", "social", 12.0)],
            source_runs=[build_source_run("reddit", False, 0, duration_ms=900, error_message="timeout")],
            pipeline_runs=[build_pipeline_run(failed_source_count=1, successful_source_count=3)],
        ).to_dict()
        self.assertEqual(payload["operations"]["recentRuns"][0]["status"], "degraded")
        self.assertEqual(payload["sourceWatch"][0]["source"], "reddit")
        self.assertEqual(payload["sourceWatch"][0]["detail"], "Latest run failed")
        self.assertEqual(payload["sources"][0]["status"], "stale")
        self.assertEqual(payload["sources"][0]["errorMessage"], "timeout")

    def test_build_source_summary_payload_uses_api_style_keys(self) -> None:
        generated_at = datetime(2026, 3, 9, 21, 8, 16, tzinfo=timezone.utc)
        payload = build_source_summary_payload(
            generated_at=generated_at,
            sources=[build_source_summary_record("reddit")],
        ).to_dict()
        self.assertEqual(payload["generatedAt"], "2026-03-09T21:08:16Z")
        self.assertEqual(payload["sources"][0]["latestFetchAt"], "2026-03-08T00:00:00Z")
        self.assertEqual(payload["sources"][0]["rawItemCount"], 5)
        self.assertEqual(payload["sources"][0]["runHistory"][0]["itemCount"], 3)
        self.assertEqual(payload["sources"][0]["runHistory"][0]["keptItemCount"], 3)
        self.assertEqual(payload["sources"][0]["runHistory"][0]["yieldRatePercent"], 100.0)
        self.assertEqual(payload["sources"][0]["yieldRatePercent"], 60.0)
        self.assertEqual(payload["sources"][0]["signalYieldRatio"], 0.6)
        self.assertEqual(payload["sources"][0]["topTrends"][0]["scoreTotal"], 42.4)

    def test_build_source_summary_records_uses_runs_and_trends(self) -> None:
        records = build_source_summary_records(
            trends=[build_detail_record("ai agents")],
            signals=[
                build_signal("ai agents", "reddit", "social", 12.0),
                build_signal("ai agents", "reddit", "social", 10.0),
            ],
            latest_source_runs=[build_source_run("reddit", True, 3, duration_ms=120, used_fallback=True)],
            source_run_history={"reddit": [build_source_run("reddit", True, 3, duration_ms=120, used_fallback=True)]},
        )
        reddit_record = next(record for record in records if record.source == "reddit")
        self.assertEqual(reddit_record.status, "degraded")
        self.assertEqual(reddit_record.raw_item_count, 3)
        self.assertEqual(reddit_record.kept_item_count, 3)
        self.assertEqual(reddit_record.yield_rate_percent, 100.0)
        self.assertEqual(reddit_record.signal_yield_ratio, 0.67)
        self.assertEqual(reddit_record.top_trends[0].id, "ai-agents")


def build_score(topic: str, display_name: str | None = None) -> TrendScoreResult:
    """Create a stable score fixture."""

    return TrendScoreResult(
        topic=topic,
        total_score=42.4,
        search_score=0.0,
        social_score=18.2,
        developer_score=16.1,
        knowledge_score=6.4,
        diversity_score=1.7,
        evidence=[f"{topic} evidence"],
        source_counts={"github": 1, "reddit": 1},
        latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
        display_name=display_name,
    )


def build_explorer_record(topic: str) -> TrendExplorerRecord:
    """Create a stable explorer fixture."""

    return TrendExplorerRecord(
        id="ai-agents",
        name="AI Agents",
        category="artificial-intelligence",
        meta_trend="AI and automation",
        stage="breakout",
        confidence=0.86,
        summary="AI Agents is a breakout artificial intelligence trend validated by 2 signals across 2 sources.",
        status="breakout",
        volatility="spiking",
        rank=1,
        previous_rank=4,
        rank_change=3,
        first_seen_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        latest_signal_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
        score=build_score(topic),
        momentum=TrendMomentum(
            previous_rank=4,
            rank_change=3,
            absolute_delta=12.3,
            percent_delta=40.2,
        ),
        source_count=2,
        signal_count=2,
        recent_history=[
            TrendHistoryPoint(
                captured_at=datetime(2026, 3, 7, tzinfo=timezone.utc),
                rank=7,
                score_total=20.4,
            ),
            TrendHistoryPoint(
                captured_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
                rank=4,
                score_total=31.1,
            ),
        ],
        audience_summary=[
            TrendAudienceSegment(segment_type="audience", label="developer", signal_count=2),
            TrendAudienceSegment(segment_type="market", label="b2b", signal_count=1),
            TrendAudienceSegment(segment_type="language", label="EN", signal_count=2),
        ],
        primary_evidence=TrendPrimaryEvidence(
            source="reddit",
            signal_type="social",
            timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            value=12.0,
            evidence="AI agents evidence",
            evidence_url="https://example.com/ai-agents",
        ),
        seasonality=SeasonalityResult(
            tag="recurring",
            recurrence_count=2,
            avg_gap_runs=3.5,
            confidence=0.82,
        ),
        forecast_direction="accelerating",
    )


def build_detail_record(topic: str) -> TrendDetailRecord:
    """Create a stable detail fixture."""

    return TrendDetailRecord(
        id="ai-agents",
        name="AI Agents",
        category="artificial-intelligence",
        meta_trend="AI and automation",
        stage="breakout",
        confidence=0.86,
        summary="AI Agents is a breakout artificial intelligence trend validated by 2 signals across 2 sources.",
        why_now=[
            "Social signals are leading the move (18.2 score).",
            "Cross-source confirmation is present across 2 sources.",
            "The trend improved by 3 ranking positions since the previous run.",
        ],
        status="breakout",
        volatility="spiking",
        rank=1,
        previous_rank=4,
        rank_change=3,
        first_seen_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        latest_signal_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
        score=build_score(topic),
        momentum=TrendMomentum(
            previous_rank=4,
            rank_change=3,
            absolute_delta=12.3,
            percent_delta=40.2,
        ),
        breakout_prediction=BreakoutPredictionSummary(
            confidence=0.78,
            predicted_direction="breakout",
            signals=["Score accelerating (+3.0/run)", "High base score (42.4)"],
        ),
        forecast=TrendForecast(
            predicted_scores=[47.2, 51.6, 56.0, 60.4, 64.8],
            confidence="high",
            mape=8.4,
            method="holt",
        ),
        opportunity=OpportunitySummary(
            composite=0.72,
            discovery=0.67,
            seo=0.64,
            content=0.69,
            product=0.74,
            investment=0.71,
            reasoning=["Strong content play (social 18, 1 evidence items)", "Product opportunity (dev 16, rank #1)"],
        ),
        source_count=2,
        signal_count=2,
        sources=["github", "reddit"],
        aliases=["AI Agents", "ai agents", "AI"],
        history=[
            TrendHistoryPoint(
                captured_at=datetime(2026, 3, 7, tzinfo=timezone.utc),
                rank=4,
                score_total=20.4,
            ),
            TrendHistoryPoint(
                captured_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
                rank=1,
                score_total=42.4,
            ),
        ],
        source_breakdown=[
            TrendSourceBreakdown(
                source="reddit",
                signal_count=1,
                latest_signal_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
            )
        ],
        source_contributions=[
            TrendSourceContribution(
                source="reddit",
                signal_count=1,
                latest_signal_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
                estimated_score=24.15,
                score_share_percent=57.1,
                social_score=18.2,
                developer_score=0.0,
                knowledge_score=6.0,
                search_score=0.0,
                diversity_score=0.0,
            )
        ],
        market_footprint=[
            TrendMetricSnapshot(
                source="google_trends",
                metric_key="search_traffic",
                label="Google search traffic",
                value_numeric=2400000.0,
                value_display="2.4M",
                unit="searches",
                period="current run",
                captured_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
                confidence=0.88,
                provenance_url="https://trends.google.com/example",
                is_estimated=False,
            )
        ],
        geo_summary=[
            TrendGeoSummary(
                label="US",
                country_code="US",
                region="US",
                signal_count=1,
                explicit_count=1,
                inferred_count=0,
                average_confidence=0.95,
            )
        ],
        audience_summary=[
            TrendAudienceSegment(
                segment_type="audience",
                label="developer",
                signal_count=2,
            ),
            TrendAudienceSegment(
                segment_type="market",
                label="b2b",
                signal_count=2,
            ),
        ],
        evidence_items=[
            TrendEvidenceItem(
                source="reddit",
                signal_type="social",
                timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
                value=12.0,
                evidence="AI agents evidence",
                evidence_url="https://example.com/ai-agents",
                language_code="en",
                audience_flags=("developer", "founder"),
                market_flags=("b2b",),
                geo_flags=("geo:explicit", "geo:country:US", "geo:region:US"),
                geo_country_code="US",
                geo_region="US",
                geo_detection_mode="explicit",
                geo_confidence=0.95,
            )
        ],
        primary_evidence=TrendPrimaryEvidence(
            source="reddit",
            signal_type="social",
            timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            value=12.0,
            evidence="AI agents evidence",
            evidence_url="https://example.com/ai-agents",
        ),
        duplicate_candidates=[
            TrendDuplicateCandidate(
                id="ai-agent",
                name="AI Agent",
                similarity=0.82,
                reason="Tracked aliases strongly overlap.",
            )
        ],
        related_trends=[
            RelatedTrend(
                id="agentic-workflows",
                name="Agentic Workflows",
                status="rising",
                rank=6,
                score_total=28.1,
                relationship_strength=0.8,
            )
        ],
        seasonality=SeasonalityResult(
            tag="recurring",
            recurrence_count=2,
            avg_gap_runs=3.5,
            confidence=0.82,
        ),
    )


def build_signal(topic: str, source: str, signal_type: str, value: float) -> NormalizedSignal:
    """Create a stable signal fixture."""

    return NormalizedSignal(
        topic=topic,
        source=source,
        signal_type=signal_type,
        value=value,
        timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
        evidence=f"{topic} evidence",
        language_code="en",
        audience_flags=("developer",) if source == "github" else ("founder",),
        market_flags=("b2b",),
    )


def build_source_run(
    source: str,
    success: bool,
    item_count: int,
    duration_ms: int,
    raw_item_count: int | None = None,
    kept_item_count: int | None = None,
    used_fallback: bool = False,
    error_message: str | None = None,
) -> SourceIngestionRun:
    """Create a stable source ingestion run fixture."""

    return SourceIngestionRun(
        source=source,
        fetched_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
        success=success,
        raw_item_count=item_count if raw_item_count is None else raw_item_count,
        item_count=item_count,
        kept_item_count=item_count if kept_item_count is None else kept_item_count,
        duration_ms=duration_ms,
        raw_topic_count=4,
        merged_topic_count=3,
        duplicate_topic_count=1,
        duplicate_topic_rate=25.0,
        used_fallback=used_fallback,
        error_message=error_message,
    )


def build_source_summary_record(source: str) -> SourceSummaryRecord:
    """Create a stable source summary fixture."""

    return SourceSummaryRecord(
        source=source,
        status="healthy",
        latest_fetch_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
        latest_success_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
        raw_item_count=5,
        latest_item_count=3,
        kept_item_count=3,
        yield_rate_percent=60.0,
        signal_yield_ratio=0.6,
        duration_ms=120,
        raw_topic_count=4,
        merged_topic_count=3,
        duplicate_topic_count=1,
        duplicate_topic_rate=25.0,
        used_fallback=False,
        error_message=None,
        signal_count=2,
        trend_count=1,
        run_history=[build_source_run(source, True, 3, duration_ms=120)],
        top_trends=[
            SourceSummaryTrend(
                id="ai-agents",
                name="AI Agents",
                rank=1,
                score_total=42.4,
            )
        ],
    )


def build_pipeline_run(
    *,
    failed_source_count: int = 0,
    successful_source_count: int = 4,
) -> PipelineRun:
    """Create a stable pipeline run fixture."""

    return PipelineRun(
        captured_at=datetime(2026, 3, 9, 21, 8, 16, tzinfo=timezone.utc),
        duration_ms=2400,
        source_count=4,
        successful_source_count=successful_source_count,
        failed_source_count=failed_source_count,
        signal_count=42,
        ranked_trend_count=10,
        top_topic="ai agents",
        top_score=42.4,
    )
