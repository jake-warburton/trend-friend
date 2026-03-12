"""Tests for trend scoring and ranking."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.models import TopicAggregate, TrendScoreResult
from app.scoring.calculator import calculate_trend_scores
from app.scoring.ranking import rank_topics_by_score


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

    def test_rank_topics_by_score_is_deterministic(self) -> None:
        timestamp = datetime(2026, 3, 8, tzinfo=timezone.utc)
        lower = TrendScoreResult("battery", 10.0, 0.0, 5.0, 2.0, 1.0, 2.0, [], {}, timestamp)
        alpha = TrendScoreResult("alpha", 20.0, 0.0, 8.0, 5.0, 3.0, 4.0, [], {}, timestamp)
        zeta = TrendScoreResult("zeta", 20.0, 0.0, 8.0, 5.0, 3.0, 4.0, [], {}, timestamp)
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
                diversity_score=0.0,
                evidence=["Thin evidence"],
                source_counts={"reddit": 1},
                latest_timestamp=timestamp,
            )
            for index in range(5)
        ]

        ranked = rank_topics_by_score(protected_scores + weak_tail_scores, limit=30)

        self.assertEqual(len(ranked), 25)
        self.assertTrue(all(score.topic.startswith("topic-") for score in ranked))

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
