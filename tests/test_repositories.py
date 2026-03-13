"""Tests for repository persistence behavior."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.data.database import connect_database, initialize_database
from app.data.repositories import (
    PipelineRunRepository,
    SignalRepository,
    SourceIngestionRunRepository,
    TrendScoreRepository,
    WatchlistRepository,
    format_category_label,
)
from app.models import NormalizedSignal, PipelineRun, SourceIngestionRun, TrendMomentum, TrendScoreResult
from app.theses.matching import ThesisMatchCandidate


class RepositoryTests(unittest.TestCase):
    """SQLite repositories should round-trip the shared models."""

    def setUp(self) -> None:
        self.database_path = Path("data/test_signal_eye.db")
        if self.database_path.exists():
            self.database_path.unlink()
        self.connection = connect_database(self.database_path)
        initialize_database(self.connection)

    def tearDown(self) -> None:
        self.connection.close()
        if self.database_path.exists():
            self.database_path.unlink()

    def test_signal_repository_round_trip(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        signals = [
            NormalizedSignal(
                "ai agents",
                "reddit",
                "social",
                42.0,
                timestamp,
                "AI agents",
                language_code="en",
                audience_flags=("developer", "founder"),
                market_flags=("b2b",),
                geo_flags=("geo:inferred", "geo:country:GB", "geo:region:London"),
                geo_country_code="GB",
                geo_region="London",
                geo_detection_mode="inferred",
                geo_confidence=0.65,
            ),
            NormalizedSignal("battery recycling", "wikipedia", "knowledge", 55.0, timestamp, "Battery recycling"),
        ]
        repository = SignalRepository(self.connection)
        repository.replace_signals(signals)
        stored_signals = repository.list_signals()
        self.assertEqual(stored_signals, signals)
        self.assertEqual(stored_signals[0].geo_region, "London")
        self.assertEqual(stored_signals[0].language_code, "en")

    def test_source_ingestion_run_repository_returns_latest_runs_per_source(self) -> None:
        repository = SourceIngestionRunRepository(self.connection)
        repository.append_runs(
            [
                SourceIngestionRun(
                    source="reddit",
                    fetched_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
                    success=True,
                    raw_item_count=15,
                    item_count=10,
                    kept_item_count=10,
                    duration_ms=120,
                    raw_topic_count=12,
                    merged_topic_count=9,
                    duplicate_topic_count=3,
                    duplicate_topic_rate=25.0,
                ),
                SourceIngestionRun(
                    source="reddit",
                    fetched_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
                    success=False,
                    raw_item_count=30,
                    item_count=0,
                    kept_item_count=0,
                    duration_ms=950,
                    raw_topic_count=18,
                    merged_topic_count=12,
                    duplicate_topic_count=6,
                    duplicate_topic_rate=33.3,
                    error_message="timeout",
                ),
                SourceIngestionRun(
                    source="github",
                    fetched_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
                    success=True,
                    raw_item_count=8,
                    item_count=4,
                    kept_item_count=4,
                    duration_ms=80,
                    raw_topic_count=7,
                    merged_topic_count=5,
                    duplicate_topic_count=2,
                    duplicate_topic_rate=28.6,
                    used_fallback=True,
                ),
            ]
        )

        runs = repository.list_latest_runs()

        self.assertEqual(len(runs), 2)
        reddit_run = next(run for run in runs if run.source == "reddit")
        self.assertFalse(reddit_run.success)
        self.assertEqual(reddit_run.error_message, "timeout")
        self.assertEqual(reddit_run.raw_item_count, 30)
        self.assertEqual(reddit_run.raw_topic_count, 18)
        self.assertEqual(reddit_run.merged_topic_count, 12)
        self.assertEqual(reddit_run.duplicate_topic_count, 6)
        self.assertEqual(reddit_run.duplicate_topic_rate, 33.3)
        github_run = next(run for run in runs if run.source == "github")
        self.assertTrue(github_run.used_fallback)
        self.assertEqual(github_run.kept_item_count, 4)
        self.assertEqual(github_run.duration_ms, 80)

    def test_format_category_label_preserves_acronyms_and_title_cases_words(self) -> None:
        self.assertEqual(format_category_label("ai-machine-learning"), "AI Machine Learning")
        self.assertEqual(format_category_label("hardware-robotics"), "Hardware Robotics")
        self.assertEqual(format_category_label("general-tech"), "General Tech")

    def test_build_trend_summary_omits_generic_general_tech_category_label(self) -> None:
        score = TrendScoreResult(
            topic="robotics",
            total_score=18.0,
            search_score=4.0,
            social_score=5.0,
            developer_score=6.0,
            knowledge_score=2.0,
            diversity_score=1.0,
            evidence=["Robotics"],
            source_counts={"github": 1, "reddit": 1},
            latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
        )
        momentum = TrendMomentum(previous_rank=8, rank_change=-1, absolute_delta=-2.0, percent_delta=-10.0)

        summary = TrendScoreRepository._build_trend_summary(score, "general-tech", momentum, history_length=4)

        self.assertEqual(summary, "Robotics is a cooling trend validated by 2 signals across 2 sources.")

    def test_trend_score_repository_round_trip(self) -> None:
        score = TrendScoreResult(
            topic="ai agents",
            total_score=44.2,
            search_score=0.0,
            social_score=20.0,
            developer_score=12.0,
            knowledge_score=8.2,
            diversity_score=4.0,
            evidence=["AI agents"],
            source_counts={"reddit": 1, "github": 1},
            latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            display_name="AI Agents",
        )
        repository = TrendScoreRepository(self.connection)
        repository.replace_scores([score])
        stored_scores = repository.list_scores(limit=5)
        self.assertEqual(stored_scores, [score])

    def test_trend_score_repository_keeps_experimental_scores_out_of_published_views(self) -> None:
        published_score = build_score(topic="ai agents", total_score=20.0)
        experimental_score = build_score(topic="experimental ai", total_score=14.0)

        repository = TrendScoreRepository(self.connection)
        repository.replace_scores(
            [published_score, experimental_score],
            published_topics={published_score.topic},
        )

        stored_scores = repository.list_scores(limit=5)
        self.assertEqual(len(stored_scores), 1)
        self.assertEqual(stored_scores[0].topic, published_score.topic)
        self.assertEqual(stored_scores[0].display_name, "AI Agents")

    def test_pipeline_run_repository_returns_recent_runs(self) -> None:
        repository = PipelineRunRepository(self.connection)
        repository.append_run(
            PipelineRun(
                captured_at=datetime(2026, 3, 8, tzinfo=timezone.utc),
                duration_ms=1800,
                source_count=4,
                successful_source_count=4,
                failed_source_count=0,
                signal_count=40,
                ranked_trend_count=10,
                top_topic="ai agents",
                top_score=41.2,
                raw_topic_count=36,
                merged_topic_count=30,
                duplicate_topic_count=6,
                duplicate_topic_rate=16.7,
                multi_source_trend_count=7,
                low_evidence_trend_count=2,
            )
        )
        repository.append_run(
            PipelineRun(
                captured_at=datetime(2026, 3, 9, tzinfo=timezone.utc),
                duration_ms=2200,
                source_count=4,
                successful_source_count=3,
                failed_source_count=1,
                signal_count=32,
                ranked_trend_count=9,
                top_topic="battery recycling",
                top_score=28.4,
                raw_topic_count=25,
                merged_topic_count=22,
                duplicate_topic_count=3,
                duplicate_topic_rate=12.0,
                multi_source_trend_count=5,
                low_evidence_trend_count=1,
            )
        )

        runs = repository.list_recent_runs(limit=5)

        self.assertEqual(len(runs), 2)
        self.assertEqual(runs[0].captured_at, datetime(2026, 3, 9, tzinfo=timezone.utc))
        self.assertEqual(runs[0].failed_source_count, 1)
        self.assertEqual(runs[0].raw_topic_count, 25)
        self.assertEqual(runs[0].duplicate_topic_count, 3)
        self.assertEqual(runs[0].duplicate_topic_rate, 12.0)
        self.assertEqual(runs[0].multi_source_trend_count, 5)
        self.assertEqual(runs[0].low_evidence_trend_count, 1)
        self.assertEqual(runs[1].top_topic, "ai agents")

    def test_trend_score_repository_stores_history_snapshots(self) -> None:
        repository = TrendScoreRepository(self.connection)
        captured_at = datetime(2026, 3, 9, tzinfo=timezone.utc)
        score = TrendScoreResult(
            topic="battery recycling",
            total_score=10.0,
            search_score=0.0,
            social_score=4.0,
            developer_score=3.0,
            knowledge_score=2.0,
            diversity_score=1.0,
            evidence=["Battery recycling"],
            source_counts={"reddit": 1},
            latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            display_name="Battery Recycling",
        )
        repository.append_snapshot([score], captured_at=captured_at)
        latest_captured_at, latest_scores = repository.list_latest_snapshot(limit=5)
        history = repository.list_score_history(limit_runs=5, per_run_limit=5)
        self.assertEqual(latest_captured_at, captured_at)
        self.assertEqual(latest_scores, [score])
        self.assertEqual(history, [(captured_at, [score])])

    def test_trend_score_repository_returns_latest_experimental_snapshot(self) -> None:
        repository = TrendScoreRepository(self.connection)
        captured_at = datetime(2026, 3, 9, tzinfo=timezone.utc)
        published_score = build_score(topic="ai agents", total_score=20.0)
        experimental_score = build_score(topic="experimental ai", total_score=14.0)

        repository.append_snapshot(
            [published_score, experimental_score],
            captured_at=captured_at,
            published_topics={published_score.topic},
        )

        latest_captured_at, latest_scores = repository.list_latest_snapshot(limit=5)
        latest_experimental_at, latest_experimental = repository.list_latest_experimental_snapshot(limit=5)

        self.assertEqual(latest_captured_at, captured_at)
        self.assertEqual(len(latest_scores), 1)
        self.assertEqual(latest_scores[0].topic, published_score.topic)
        self.assertEqual(latest_experimental_at, captured_at)
        self.assertEqual(len(latest_experimental), 1)
        self.assertEqual(latest_experimental[0].topic, experimental_score.topic)

    def test_trend_score_repository_builds_explorer_records_with_movement(self) -> None:
        repository = TrendScoreRepository(self.connection)
        previous_captured_at = datetime(2026, 3, 8, tzinfo=timezone.utc)
        latest_captured_at = datetime(2026, 3, 9, tzinfo=timezone.utc)

        repository.append_snapshot(
            [
                build_score(topic="battery recycling", total_score=20.0),
                build_score(topic="ai agents", total_score=10.0),
            ],
            captured_at=previous_captured_at,
        )
        repository.append_snapshot(
            [
                build_score(topic="ai agents", total_score=30.0),
                build_score(topic="battery recycling", total_score=25.0),
            ],
            captured_at=latest_captured_at,
        )

        records = repository.list_trend_explorer_records(limit=5)
        ai_agents = next(record for record in records if record.id == "ai-agents")

        self.assertEqual(ai_agents.rank, 1)
        self.assertEqual(ai_agents.previous_rank, 2)
        self.assertEqual(ai_agents.rank_change, 1)
        self.assertEqual(ai_agents.first_seen_at, previous_captured_at)
        self.assertEqual(ai_agents.momentum.absolute_delta, 20.0)
        self.assertEqual(ai_agents.momentum.percent_delta, 200.0)
        self.assertEqual(ai_agents.status, "breakout")
        self.assertEqual(ai_agents.category, "ai-machine-learning")
        self.assertEqual(ai_agents.meta_trend, "AI and automation")
        self.assertEqual(ai_agents.stage, "nascent")
        self.assertGreater(ai_agents.confidence, 0.35)
        self.assertIn("AI Agents is a nascent", ai_agents.summary)
        self.assertIn("AI Machine Learning trend", ai_agents.summary)
        self.assertEqual(ai_agents.volatility, "spiking")
        self.assertEqual(ai_agents.source_count, 2)
        self.assertEqual(ai_agents.signal_count, 2)

    def test_trend_score_repository_builds_detail_records_with_signal_breakdown(self) -> None:
        repository = TrendScoreRepository(self.connection)
        signal_repository = SignalRepository(self.connection)
        previous_captured_at = datetime(2026, 3, 8, tzinfo=timezone.utc)
        latest_captured_at = datetime(2026, 3, 9, tzinfo=timezone.utc)

        signal_repository.replace_signals(
            [
                NormalizedSignal(
                    "ai agents",
                    "reddit",
                    "social",
                    12.0,
                    latest_captured_at,
                    "Reddit evidence",
                    language_code="en",
                    audience_flags=("developer", "founder"),
                    market_flags=("b2b", "europe-market"),
                    geo_flags=("geo:inferred", "geo:country:GB", "geo:region:London"),
                    geo_country_code="GB",
                    geo_region="London",
                    geo_detection_mode="inferred",
                    geo_confidence=0.65,
                ),
                NormalizedSignal("ai agents", "github", "developer", 9.0, previous_captured_at, "GitHub evidence"),
            ]
        )
        repository.append_snapshot(
            [build_score(topic="ai agents", total_score=10.0)],
            captured_at=previous_captured_at,
        )
        repository.append_snapshot(
            [build_score(topic="ai agents", total_score=30.0)],
            captured_at=latest_captured_at,
        )

        records = repository.list_trend_detail_records(limit=5)

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].history[0].captured_at, previous_captured_at)
        self.assertEqual(records[0].status, "breakout")
        self.assertEqual(records[0].category, "ai-machine-learning")
        self.assertEqual(records[0].meta_trend, "AI and automation")
        self.assertEqual(records[0].stage, "nascent")
        self.assertGreater(records[0].confidence, 0.35)
        self.assertIn("AI Agents is a nascent", records[0].summary)
        self.assertGreaterEqual(len(records[0].why_now), 2)
        self.assertIn("ai agents", [alias.lower() for alias in records[0].aliases])
        self.assertEqual(records[0].volatility, "spiking")
        self.assertEqual(records[0].geo_summary[0].country_code, "GB")
        self.assertEqual(records[0].geo_summary[0].signal_count, 1)
        self.assertEqual(records[0].audience_summary[0].segment_type, "audience")
        self.assertEqual(records[0].audience_summary[0].label, "developer")
        self.assertEqual(records[0].source_breakdown[0].source, "github")
        self.assertEqual(records[0].source_contributions[0].source, "reddit")
        self.assertEqual(records[0].source_contributions[0].score_share_percent, 36.7)
        self.assertEqual(records[0].source_contributions[0].social_score, 10.0)
        self.assertEqual(records[0].market_footprint[0].source, "github")
        self.assertEqual(records[0].market_footprint[0].label, "GitHub stars + forks")
        self.assertEqual(records[0].market_footprint[0].value_display, "9")
        self.assertFalse(records[0].market_footprint[0].is_estimated)
        self.assertEqual(records[0].market_footprint[1].source, "reddit")
        self.assertTrue(records[0].market_footprint[1].is_estimated)
        self.assertEqual(records[0].breakout_prediction.predicted_direction, "breakout")
        self.assertIsNone(records[0].forecast)
        self.assertGreater(records[0].opportunity.composite, 0.0)
        self.assertEqual(records[0].evidence_items[0].evidence, "Reddit evidence")

    def test_trend_score_repository_builds_forecasts_for_longer_histories(self) -> None:
        repository = TrendScoreRepository(self.connection)
        base_captured_at = datetime(2026, 3, 4, tzinfo=timezone.utc)

        for day_offset, score_total in enumerate([10.0, 15.0, 21.0, 28.0, 36.0, 45.0]):
            repository.append_snapshot(
                [build_score(topic="ai agents", total_score=score_total)],
                captured_at=base_captured_at + timedelta(days=day_offset),
            )

        detail_records = repository.list_trend_detail_records(limit=5)
        explorer_records = repository.list_trend_explorer_records(limit=5)

        self.assertEqual(detail_records[0].forecast.method, "holt")
        self.assertEqual(detail_records[0].forecast.confidence, "medium")
        self.assertEqual(len(detail_records[0].forecast.predicted_scores), 5)
        self.assertEqual(explorer_records[0].forecast_direction, "accelerating")

    def test_get_topic_appearance_gaps_returns_missing_run_counts(self) -> None:
        repository = TrendScoreRepository(self.connection)
        base_captured_at = datetime(2026, 3, 4, tzinfo=timezone.utc)

        repository.append_snapshot([build_score(topic="ai agents", total_score=10.0)], captured_at=base_captured_at)
        repository.append_snapshot([build_score(topic="battery recycling", total_score=12.0)], captured_at=base_captured_at + timedelta(days=1))
        repository.append_snapshot([build_score(topic="battery recycling", total_score=14.0)], captured_at=base_captured_at + timedelta(days=2))
        repository.append_snapshot([build_score(topic="ai agents", total_score=16.0)], captured_at=base_captured_at + timedelta(days=3))

        self.assertEqual(repository.get_topic_appearance_gaps("ai agents"), [2])

    def test_trend_score_repository_builds_recurring_seasonality(self) -> None:
        repository = TrendScoreRepository(self.connection)
        base_captured_at = datetime(2026, 3, 1, tzinfo=timezone.utc)
        score_totals = [12.0, 14.0, None, None, None, 18.0, 20.0, None, None, None, 24.0]

        for day_offset, total_score in enumerate(score_totals):
            scores = [build_score(topic="battery recycling", total_score=8.0)]
            if total_score is not None:
                scores.insert(0, build_score(topic="tax software", total_score=total_score))
            repository.append_snapshot(scores, captured_at=base_captured_at + timedelta(days=day_offset))

        detail_records = repository.list_trend_detail_records(limit=5)
        explorer_records = repository.list_trend_explorer_records(limit=5)
        tax_detail = next(record for record in detail_records if record.id == "tax-software")
        tax_explorer = next(record for record in explorer_records if record.id == "tax-software")

        self.assertEqual(tax_detail.seasonality.tag, "recurring")
        self.assertEqual(tax_detail.seasonality.recurrence_count, 2)
        self.assertEqual(tax_explorer.seasonality.tag, "recurring")

    def test_trend_score_repository_persists_trend_entities(self) -> None:
        repository = TrendScoreRepository(self.connection)
        captured_at = datetime(2026, 3, 9, tzinfo=timezone.utc)

        repository.append_snapshot(
            [build_score(topic="ai agents", total_score=30.0)],
            captured_at=captured_at,
        )

        entity = repository.get_trend_entity("ai agents")

        self.assertIsNotNone(entity)
        assert entity is not None
        self.assertEqual(entity.canonical_name, "AI Agents")
        self.assertEqual(entity.category, "ai-machine-learning")
        self.assertEqual(entity.meta_trend, "AI and automation")
        self.assertEqual(entity.stage, "nascent")
        self.assertGreater(entity.confidence, 0.0)
        self.assertIn("AI Agents is a nascent", entity.summary)
        self.assertGreaterEqual(len(entity.why_now), 1)
        self.assertIn("ai agents", [alias.lower() for alias in entity.aliases])
        self.assertEqual(entity.last_seen_at, datetime(2026, 3, 8, tzinfo=timezone.utc))

    def test_trend_score_repository_persists_related_relationship_strength(self) -> None:
        repository = TrendScoreRepository(self.connection)
        captured_at = datetime(2026, 3, 9, tzinfo=timezone.utc)

        repository.append_snapshot(
            [
                build_score(topic="ai agents", total_score=30.0),
                build_score(topic="agent workflows", total_score=24.0),
            ],
            captured_at=captured_at,
        )

        records = repository.list_trend_detail_records(limit=5)
        ai_agents = next(record for record in records if record.id == "ai-agents")

        self.assertTrue(ai_agents.related_trends)
        self.assertEqual(ai_agents.related_trends[0].id, "agent-workflows")
        self.assertGreater(ai_agents.related_trends[0].relationship_strength, 0.0)

    def test_trend_score_repository_penalizes_and_persists_duplicate_candidates(self) -> None:
        repository = TrendScoreRepository(self.connection)
        captured_at = datetime(2026, 3, 9, tzinfo=timezone.utc)

        repository.append_snapshot(
            [
                build_score(topic="ai agents", total_score=30.0),
                build_score(topic="ai agent", total_score=24.0),
                build_score(topic="battery recycling", total_score=18.0),
            ],
            captured_at=captured_at,
        )

        detail_records = repository.list_trend_detail_records(limit=5)
        ai_agents = next(record for record in detail_records if record.id == "ai-agents")
        ai_agent = next(record for record in detail_records if record.id == "ai-agent")

        self.assertTrue(ai_agent.duplicate_candidates)
        self.assertEqual(ai_agent.duplicate_candidates[0].id, "ai-agents")
        self.assertGreater(ai_agent.duplicate_candidates[0].similarity, 0.55)
        self.assertLess(ai_agent.confidence, ai_agents.confidence)

    def test_trend_score_repository_applies_curation_override_preferences_and_suppression(self) -> None:
        repository = TrendScoreRepository(self.connection)
        captured_at = datetime(2026, 3, 9, tzinfo=timezone.utc)

        repository.upsert_trend_curation_override(
            "ai-agents",
            preferred_name="AI Agent Platforms",
            preferred_meta_trend="Agent tooling",
            preferred_stage="validated",
            preferred_summary="Curated summary for manual review.",
        )
        repository.upsert_trend_curation_override(
            "ai-agent",
            suppress=True,
            canonical_topic_key="ai-agents",
        )
        repository.append_snapshot(
            [
                build_score(topic="ai agents", total_score=30.0),
                build_score(topic="ai agent", total_score=24.0),
            ],
            captured_at=captured_at,
        )

        entity = repository.get_trend_entity("ai agents")
        explorer_records = repository.list_trend_explorer_records(limit=5)

        assert entity is not None
        self.assertEqual(entity.canonical_name, "AI Agent Platforms")
        self.assertEqual(entity.meta_trend, "Agent tooling")
        self.assertEqual(entity.stage, "validated")
        self.assertEqual(entity.summary, "Curated summary for manual review.")
        self.assertEqual([record.id for record in explorer_records], ["ai-agents"])

    def test_watchlist_repository_round_trip(self) -> None:
        repository = WatchlistRepository(self.connection)

        watchlist = repository.ensure_default_watchlist()
        updated = repository.add_item(watchlist.id, "ai-agents", "AI Agents")
        repository.create_alert_rule(
            watchlist_id=watchlist.id,
            name="Score >= 25",
            rule_type="score_above",
            threshold=25.0,
        )

        self.assertEqual(updated.items[0].trend_id, "ai-agents")
        self.assertEqual(repository.list_watchlists()[0].name, "Core Watchlist")
        self.assertEqual(repository.list_alert_rules()[0].rule_type, "score_above")

    def test_watchlist_repository_persists_theses_and_matches(self) -> None:
        repository = WatchlistRepository(self.connection)
        watchlist = repository.create_watchlist("Research")

        thesis = repository.create_trend_thesis(
            watchlist_id=watchlist.id,
            name="SEO opportunities",
            lens="seo",
            stage="nascent",
            minimum_score=20.0,
            notify_on_match=True,
        )

        self.assertEqual(repository.list_trend_theses()[0].name, "SEO opportunities")
        thesis_rule = next(rule for rule in repository.list_alert_rules() if rule.thesis_id == thesis.id)
        self.assertEqual(thesis_rule.rule_type, "thesis_match")

        created_at = datetime(2026, 3, 10, tzinfo=timezone.utc)
        new_matches = repository.replace_trend_thesis_matches(
            [thesis],
            {
                thesis.id: [
                    ThesisMatchCandidate(
                        thesis_id=thesis.id,
                        trend_id="ai-agents",
                        trend_name="AI Agents",
                        lens_score=71.2,
                        total_score=42.0,
                    ),
                ]
            },
            matched_at=created_at,
        )

        self.assertEqual(new_matches[thesis.id][0].trend_id, "ai-agents")
        stored_matches = repository.list_trend_thesis_matches()
        self.assertEqual(stored_matches[0].trend_id, "ai-agents")
        self.assertTrue(stored_matches[0].active)

        repository.replace_trend_thesis_matches([thesis], {thesis.id: []}, matched_at=created_at)
        self.assertFalse(repository.list_trend_thesis_matches()[0].active)


def build_score(topic: str, total_score: float) -> TrendScoreResult:
    """Create a stable score fixture."""

    return TrendScoreResult(
        topic=topic,
        total_score=total_score,
        search_score=0.0,
        social_score=10.0,
        developer_score=8.0,
        knowledge_score=6.0,
        diversity_score=2.0,
        evidence=[f"{topic} evidence"],
        source_counts={"reddit": 1, "github": 1},
        latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
    )


if __name__ == "__main__":
    unittest.main()
