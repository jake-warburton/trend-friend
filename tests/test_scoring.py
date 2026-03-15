"""Tests for trend scoring and ranking."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.models import TopicAggregate, TrendScoreResult
from app.scoring.calculator import calculate_trend_scores, velocity_adjustment
from app.scoring.ranking import rank_experimental_topics, rank_topics_by_score


class TrendScoringTests(unittest.TestCase):
    """Trend scoring should stay explainable and deterministic."""

    def test_calculate_trend_scores_exposes_components(self) -> None:
        aggregate = TopicAggregate(
            topic="ai agents",
            source_counts={"reddit": 1, "github": 1, "wikipedia": 1},
            signal_counts={"social": 1, "developer": 1, "knowledge": 1},
            total_signal_value=1_000.0,
            average_signal_value=333.3,
            latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            evidence=["AI agents"],
        )
        score = calculate_trend_scores([aggregate])[0]
        self.assertGreater(score.total_score, 0)
        self.assertGreater(score.social_score, 0)
        self.assertGreater(score.developer_score, 0)
        self.assertGreater(score.knowledge_score, 0)
        self.assertEqual(score.diversity_score, 18.0)

    def test_calculate_trend_scores_rewards_cross_family_corroboration(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        corroborated = TopicAggregate(
            topic="model context protocol",
            source_counts={"github": 1, "devto": 1, "google_trends": 1},
            signal_counts={"developer": 1, "social": 1, "search": 1},
            total_signal_value=300.0,
            average_signal_value=100.0,
            latest_timestamp=timestamp,
            evidence=["Model Context Protocol", "MCP servers", "MCP search demand"],
        )
        single_family = TopicAggregate(
            topic="model context protocol",
            source_counts={"github": 2, "npm": 1},
            signal_counts={"developer": 3},
            total_signal_value=300.0,
            average_signal_value=100.0,
            latest_timestamp=timestamp,
            evidence=["Model Context Protocol", "MCP SDK", "MCP client"],
        )

        corroborated_score, single_family_score = calculate_trend_scores([corroborated, single_family])

        self.assertGreater(corroborated_score.total_score, single_family_score.total_score)

    def test_calculate_trend_scores_rewards_broad_interest_mixed_signal_topics(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        broad_interest = TopicAggregate(
            topic="iran war",
            source_counts={"google_news": 1, "reddit": 1, "google_trends": 1},
            signal_counts={"knowledge": 1, "social": 1, "search": 1},
            total_signal_value=210.0,
            average_signal_value=70.0,
            latest_timestamp=timestamp,
            evidence=["Iran war fears grow", "Iran war discussion", "Iran war search demand"],
        )
        dev_cluster = TopicAggregate(
            topic="python package",
            source_counts={"github": 1, "lobsters": 1, "devto": 1},
            signal_counts={"developer": 1, "social": 2},
            total_signal_value=210.0,
            average_signal_value=70.0,
            latest_timestamp=timestamp,
            evidence=["Python package release", "Python package launch", "Python package post"],
        )

        broad_score, dev_score = calculate_trend_scores([broad_interest, dev_cluster])

        self.assertGreater(broad_score.total_score, dev_score.total_score)

    def test_calculate_trend_scores_prefers_fresher_topics(self) -> None:
        fresh = TopicAggregate(
            topic="ai agents",
            source_counts={"reddit": 1, "github": 1},
            signal_counts={"social": 1, "developer": 1},
            total_signal_value=120.0,
            average_signal_value=60.0,
            latest_timestamp=datetime(2026, 3, 8, 12, tzinfo=timezone.utc),
            evidence=["AI agents", "AI agents framework"],
        )
        stale = TopicAggregate(
            topic="battery recycling",
            source_counts={"reddit": 1, "github": 1},
            signal_counts={"social": 1, "developer": 1},
            total_signal_value=120.0,
            average_signal_value=60.0,
            latest_timestamp=datetime(2026, 3, 5, 12, tzinfo=timezone.utc),
            evidence=["Battery recycling", "Battery recycling tooling"],
        )

        fresh_score, stale_score = calculate_trend_scores([fresh, stale])

        self.assertGreater(fresh_score.total_score, stale_score.total_score)

    def test_calculate_trend_scores_handles_negative_aggregate_values(self) -> None:
        aggregate = TopicAggregate(
            topic="prediction market anomaly",
            source_counts={"polymarket": 1},
            signal_counts={"social": 1},
            total_signal_value=-5.0,
            average_signal_value=-5.0,
            latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            evidence=["Prediction market anomaly"],
        )

        score = calculate_trend_scores([aggregate])[0]

        self.assertEqual(score.social_score, 0.0)
        self.assertGreaterEqual(score.total_score, 0.0)

    def test_velocity_adjustment_handles_negative_average_signal_value(self) -> None:
        aggregate = TopicAggregate(
            topic="prediction market anomaly",
            source_counts={"polymarket": 1},
            signal_counts={"social": 1},
            total_signal_value=5.0,
            average_signal_value=-5.0,
            latest_timestamp=datetime(2026, 3, 8, tzinfo=timezone.utc),
            evidence=["Prediction market anomaly"],
        )

        self.assertGreaterEqual(velocity_adjustment(aggregate), 0.0)

    def test_rank_topics_by_score_is_deterministic(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        lower = TrendScoreResult("battery", 10.0, 0.0, 5.0, 2.0, 1.0, 0.0, 2.0, [], {}, timestamp)
        alpha = TrendScoreResult("alpha", 20.0, 0.0, 8.0, 5.0, 3.0, 0.0, 4.0, [], {}, timestamp)
        zeta = TrendScoreResult("zeta", 20.0, 0.0, 8.0, 5.0, 3.0, 0.0, 4.0, [], {}, timestamp)
        ranked = rank_topics_by_score([zeta, lower, alpha], limit=3)
        self.assertEqual([score.topic for score in ranked], ["alpha", "zeta", "battery"])

    def test_rank_topics_by_score_demotes_low_evidence_topics_in_tail(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        protected_scores = [
            TrendScoreResult(
                topic=f"topic-{index:02d}",
                total_score=100.0 - index,
                search_score=0.0,
                social_score=20.0,
                developer_score=10.0,
                knowledge_score=5.0,
                advertising_score=0.0,
                diversity_score=6.0,
                evidence=[f"Evidence {index}", f"Evidence {index} corroborated"],
                source_counts={"reddit": 1, "github": 1},
                latest_timestamp=timestamp,
            )
            for index in range(25)
        ]
        low_evidence_tail = TrendScoreResult(
            topic="thin-tail-topic",
            total_score=18.0,
            search_score=0.0,
            social_score=18.0,
            developer_score=0.0,
            knowledge_score=0.0,
            advertising_score=0.0,
            diversity_score=0.0,
            evidence=["Thin evidence"],
            source_counts={"reddit": 1},
            latest_timestamp=timestamp,
        )
        corroborated_tail = TrendScoreResult(
            topic="corroborated-tail-topic",
            total_score=16.5,
            search_score=0.0,
            social_score=10.0,
            developer_score=4.0,
            knowledge_score=0.0,
            advertising_score=0.0,
            diversity_score=6.0,
            evidence=["Evidence one", "Evidence two"],
            source_counts={"reddit": 1, "github": 1},
            latest_timestamp=timestamp,
        )

        ranked = rank_topics_by_score(protected_scores + [low_evidence_tail, corroborated_tail], limit=27)

        self.assertEqual(ranked[25].topic, "corroborated-tail-topic")
        self.assertEqual(ranked[26].topic, "thin-tail-topic")

    def test_rank_topics_by_score_gates_low_scoring_low_evidence_tail_when_alternatives_exist(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        protected_scores = [
            TrendScoreResult(
                topic=f"topic-{index:02d}",
                total_score=100.0 - index,
                search_score=0.0,
                social_score=20.0,
                developer_score=10.0,
                knowledge_score=5.0,
                advertising_score=0.0,
                diversity_score=6.0,
                evidence=[f"Evidence {index}", f"Evidence {index} corroborated"],
                source_counts={"reddit": 1, "github": 1},
                latest_timestamp=timestamp,
            )
            for index in range(25)
        ]
        low_evidence_tail = TrendScoreResult(
            topic="thin-tail-topic",
            total_score=10.0,
            search_score=0.0,
            social_score=10.0,
            developer_score=0.0,
            knowledge_score=0.0,
            advertising_score=0.0,
            diversity_score=0.0,
            evidence=["Thin evidence"],
            source_counts={"reddit": 1},
            latest_timestamp=timestamp,
        )
        alternate_tail = TrendScoreResult(
            topic="alternate-tail-topic",
            total_score=9.0,
            search_score=0.0,
            social_score=5.0,
            developer_score=2.0,
            knowledge_score=0.0,
            advertising_score=0.0,
            diversity_score=6.0,
            evidence=["Evidence one", "Evidence two"],
            source_counts={"reddit": 1, "github": 1},
            latest_timestamp=timestamp,
        )

        ranked = rank_topics_by_score(protected_scores + [low_evidence_tail, alternate_tail], limit=26)

        self.assertEqual(len(ranked), 26)
        self.assertEqual(ranked[-1].topic, "alternate-tail-topic")
        self.assertNotIn("thin-tail-topic", [score.topic for score in ranked])

    def test_rank_topics_by_score_allows_shorter_result_when_tail_quality_is_poor(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        protected_scores = [
            TrendScoreResult(
                topic=f"topic-{index:02d}",
                total_score=100.0 - index,
                search_score=0.0,
                social_score=20.0,
                developer_score=10.0,
                knowledge_score=5.0,
                advertising_score=0.0,
                diversity_score=6.0,
                evidence=[f"Evidence {index}", f"Evidence {index} corroborated"],
                source_counts={"reddit": 1, "github": 1},
                latest_timestamp=timestamp,
            )
            for index in range(25)
        ]
        weak_tail_scores = [
            TrendScoreResult(
                topic=f"thin-tail-{index}",
                total_score=11.0 - (index * 0.1),
                search_score=0.0,
                social_score=11.0 - (index * 0.1),
                developer_score=0.0,
                knowledge_score=0.0,
                advertising_score=0.0,
                diversity_score=0.0,
                evidence=["Thin evidence"],
                source_counts={"reddit": 1},
                latest_timestamp=timestamp,
            )
            for index in range(20)
        ]

        ranked = rank_topics_by_score(protected_scores + weak_tail_scores, limit=30)

        self.assertEqual(len(ranked), 30)
        self.assertEqual(ranked[-1].topic, "thin-tail-4")

    def test_rank_topics_by_score_backfills_up_to_minimum_published_floor(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        protected_scores = [
            TrendScoreResult(
                topic=f"topic-{index:02d}",
                total_score=100.0 - index,
                search_score=0.0,
                social_score=20.0,
                developer_score=10.0,
                knowledge_score=5.0,
                advertising_score=0.0,
                diversity_score=6.0,
                evidence=[f"Evidence {index}", f"Evidence {index} corroborated"],
                source_counts={"reddit": 1, "github": 1},
                latest_timestamp=timestamp,
            )
            for index in range(25)
        ]
        weak_tail_scores = [
            TrendScoreResult(
                topic=f"thin-tail-{index}",
                total_score=11.0 - (index * 0.1),
                search_score=0.0,
                social_score=11.0 - (index * 0.1),
                developer_score=0.0,
                knowledge_score=0.0,
                advertising_score=0.0,
                diversity_score=0.0,
                evidence=["Thin evidence"],
                source_counts={"reddit": 1},
                latest_timestamp=timestamp,
            )
            for index in range(20)
        ]

        ranked = rank_topics_by_score(protected_scores + weak_tail_scores, limit=100)

        self.assertEqual(len(ranked), 40)
        self.assertEqual(ranked[-1].topic, "thin-tail-14")

    def test_rank_experimental_topics_surfaces_viable_overflow_candidates(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        published_scores = [
            TrendScoreResult(
                topic=f"topic-{index:02d}",
                total_score=100.0 - index,
                search_score=0.0,
                social_score=20.0,
                developer_score=10.0,
                knowledge_score=5.0,
                advertising_score=0.0,
                diversity_score=6.0,
                evidence=[f"Evidence {index}", f"Evidence {index} corroborated"],
                source_counts={"reddit": 1, "github": 1},
                latest_timestamp=timestamp,
            )
            for index in range(25)
        ]
        viable_experimental = TrendScoreResult(
            topic="inference framework",
            total_score=16.0,
            search_score=0.0,
            social_score=0.0,
            developer_score=16.0,
            knowledge_score=0.0,
            advertising_score=0.0,
            diversity_score=0.0,
            evidence=["Inference framework benchmarks improve compiler-backed serving latency"],
            source_counts={"github": 1},
            latest_timestamp=timestamp,
        )
        filtered_out = TrendScoreResult(
            topic="too-weak-topic",
            total_score=8.0,
            search_score=0.0,
            social_score=8.0,
            developer_score=0.0,
            knowledge_score=0.0,
            advertising_score=0.0,
            diversity_score=0.0,
            evidence=["Very thin evidence"],
            source_counts={"reddit": 1},
            latest_timestamp=timestamp,
        )

        experimental = rank_experimental_topics(
            published_scores + [viable_experimental, filtered_out],
            published_scores=published_scores,
            limit=5,
        )

        self.assertEqual([score.topic for score in experimental], ["inference framework"])

    def test_rank_experimental_topics_filters_generic_single_source_fragments(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        published_scores = [
            TrendScoreResult(
                topic=f"topic-{index:02d}",
                total_score=100.0 - index,
                search_score=0.0,
                social_score=20.0,
                developer_score=10.0,
                knowledge_score=5.0,
                advertising_score=0.0,
                diversity_score=6.0,
                evidence=[f"Evidence {index}", f"Evidence {index} corroborated"],
                source_counts={"reddit": 1, "github": 1},
                latest_timestamp=timestamp,
            )
            for index in range(25)
        ]
        concrete_candidate = TrendScoreResult(
            topic="eth phishing detect",
            total_score=15.9,
            search_score=0.0,
            social_score=0.0,
            developer_score=15.9,
            knowledge_score=0.0,
            advertising_score=0.0,
            diversity_score=0.0,
            evidence=["ETH phishing detect flags malicious wallet drainer patterns"],
            source_counts={"github": 1},
            latest_timestamp=timestamp,
        )
        generic_fragment = TrendScoreResult(
            topic="social networking",
            total_score=15.6,
            search_score=0.0,
            social_score=15.6,
            developer_score=0.0,
            knowledge_score=0.0,
            advertising_score=0.0,
            diversity_score=0.0,
            evidence=["Social networking remains a broad consumer behavior trend"],
            source_counts={"hacker_news": 1},
            latest_timestamp=timestamp,
        )

        experimental = rank_experimental_topics(
            published_scores + [concrete_candidate, generic_fragment],
            published_scores=published_scores,
            limit=5,
        )

        self.assertEqual([score.topic for score in experimental], ["eth phishing detect"])

    def test_rank_experimental_topics_rejects_general_tech_single_source_overflow(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        published_scores = [
            TrendScoreResult(
                topic=f"topic-{index:02d}",
                total_score=100.0 - index,
                search_score=0.0,
                social_score=20.0,
                developer_score=10.0,
                knowledge_score=5.0,
                advertising_score=0.0,
                diversity_score=6.0,
                evidence=[f"Evidence {index}", f"Evidence {index} corroborated"],
                source_counts={"reddit": 1, "github": 1},
                latest_timestamp=timestamp,
            )
            for index in range(25)
        ]
        general_tech_candidate = TrendScoreResult(
            topic="rewritten methodology",
            total_score=14.7,
            search_score=0.0,
            social_score=7.2,
            developer_score=0.0,
            knowledge_score=0.0,
            advertising_score=0.0,
            diversity_score=0.0,
            evidence=["Rewritten methodology for building clearer internal systems"],
            source_counts={"hacker_news": 1},
            latest_timestamp=timestamp,
        )
        developer_candidate = TrendScoreResult(
            topic="wordpress core",
            total_score=13.3,
            search_score=0.0,
            social_score=0.0,
            developer_score=5.8,
            knowledge_score=0.0,
            advertising_score=0.0,
            diversity_score=0.0,
            evidence=["WordPress core release hardens the editor pipeline"],
            source_counts={"github": 1},
            latest_timestamp=timestamp,
        )

        experimental = rank_experimental_topics(
            published_scores + [general_tech_candidate, developer_candidate],
            published_scores=published_scores,
            limit=5,
        )

        self.assertEqual([score.topic for score in experimental], ["wordpress core"])

    def test_calculate_trend_scores_prefers_specific_exact_phrases(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        specific = TopicAggregate(
            topic="street view",
            source_counts={"hacker_news": 1},
            signal_counts={"social": 1},
            total_signal_value=200.0,
            average_signal_value=200.0,
            latest_timestamp=timestamp,
            evidence=["Show HN: I Was Here – Draw on street view, others can find your drawings"],
        )
        generic = TopicAggregate(
            topic="notes baking",
            source_counts={"hacker_news": 1},
            signal_counts={"social": 1},
            total_signal_value=200.0,
            average_signal_value=200.0,
            latest_timestamp=timestamp,
            evidence=["Notes on Baking at the South Pole"],
        )
        specific_score, generic_score = calculate_trend_scores([specific, generic])
        self.assertGreater(specific_score.total_score, generic_score.total_score)

    def test_calculate_trend_scores_rewards_cross_source_coverage(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        cross_source = TopicAggregate(
            topic="ai agents",
            source_counts={"reddit": 1, "github": 1},
            signal_counts={"social": 1, "developer": 1},
            total_signal_value=500.0,
            average_signal_value=250.0,
            latest_timestamp=timestamp,
            evidence=["AI agents are replacing repetitive office workflows"],
        )
        single_source = TopicAggregate(
            topic="street view",
            source_counts={"hacker_news": 1},
            signal_counts={"social": 1},
            total_signal_value=500.0,
            average_signal_value=500.0,
            latest_timestamp=timestamp,
            evidence=["Show HN: I Was Here – Draw on street view, others can find your drawings"],
        )
        cross_source_score, single_source_score = calculate_trend_scores([cross_source, single_source])
        self.assertGreater(cross_source_score.diversity_score, single_source_score.diversity_score)
        self.assertGreater(cross_source_score.total_score, single_source_score.total_score)

    def test_calculate_trend_scores_rewards_unique_evidence_corroboration(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        corroborated = TopicAggregate(
            topic="battery recycling",
            source_counts={"reddit": 2},
            signal_counts={"social": 2},
            total_signal_value=500.0,
            average_signal_value=250.0,
            latest_timestamp=timestamp,
            evidence=[
                "Battery recycling startup expands black mass recovery",
                "Battery recycling capacity rises as EV waste grows",
            ],
        )
        single_mention = TopicAggregate(
            topic="battery recycling",
            source_counts={"reddit": 2},
            signal_counts={"social": 2},
            total_signal_value=500.0,
            average_signal_value=250.0,
            latest_timestamp=timestamp,
            evidence=["Battery recycling startup expands black mass recovery"],
        )
        corroborated_score, single_mention_score = calculate_trend_scores([corroborated, single_mention])
        self.assertGreater(corroborated_score.total_score, single_mention_score.total_score)

    def test_calculate_trend_scores_ignores_duplicate_evidence_corroboration(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        duplicated = TopicAggregate(
            topic="battery recycling",
            source_counts={"reddit": 2},
            signal_counts={"social": 2},
            total_signal_value=500.0,
            average_signal_value=250.0,
            latest_timestamp=timestamp,
            evidence=[
                "Battery recycling startup expands black mass recovery",
                "battery recycling startup expands black mass recovery",
            ],
        )
        single_mention = TopicAggregate(
            topic="battery recycling",
            source_counts={"reddit": 2},
            signal_counts={"social": 2},
            total_signal_value=500.0,
            average_signal_value=250.0,
            latest_timestamp=timestamp,
            evidence=["Battery recycling startup expands black mass recovery"],
        )
        duplicated_score, single_mention_score = calculate_trend_scores([duplicated, single_mention])
        self.assertEqual(duplicated_score.total_score, single_mention_score.total_score)

    def test_calculate_trend_scores_requires_exact_phrase_boundaries_for_bonus(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        exact_phrase = TopicAggregate(
            topic="robot",
            source_counts={"reddit": 1},
            signal_counts={"social": 1},
            total_signal_value=200.0,
            average_signal_value=200.0,
            latest_timestamp=timestamp,
            evidence=["Warehouse robot pilots spread across retail logistics"],
        )
        substring_only = TopicAggregate(
            topic="robot",
            source_counts={"reddit": 1},
            signal_counts={"social": 1},
            total_signal_value=200.0,
            average_signal_value=200.0,
            latest_timestamp=timestamp,
            evidence=["Microbot research improves targeted drug delivery"],
        )
        exact_score, substring_score = calculate_trend_scores([exact_phrase, substring_only])
        self.assertGreater(exact_score.total_score, substring_score.total_score)

    def test_calculate_trend_scores_penalizes_wikipedia_only_topics(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        wikipedia_only = TopicAggregate(
            topic="obscure biography",
            source_counts={"wikipedia": 1},
            signal_counts={"knowledge": 1},
            total_signal_value=900_000.0,
            average_signal_value=900_000.0,
            latest_timestamp=timestamp,
            evidence=["Obscure biography"],
        )
        corroborated = TopicAggregate(
            topic="obscure biography",
            source_counts={"wikipedia": 1, "reddit": 1},
            signal_counts={"knowledge": 1, "social": 1},
            total_signal_value=900_200.0,
            average_signal_value=450_100.0,
            latest_timestamp=timestamp,
            evidence=["Obscure biography", "People are suddenly discussing obscure biography"],
        )

        wikipedia_score, corroborated_score = calculate_trend_scores([wikipedia_only, corroborated])
        self.assertLess(wikipedia_score.total_score, corroborated_score.total_score)


if __name__ == "__main__":
    unittest.main()
