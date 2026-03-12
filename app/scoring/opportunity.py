"""Opportunity scoring — how actionable is a trend for content, products, or investment.

Scores each trend on multiple actionability dimensions:
  - Content opportunity: strong social signal + diverse evidence = easy to write about
  - Product opportunity: developer activity + high score = potential product play
  - Investment signal: rapid growth + multi-source = institutional interest marker

Each dimension is scored [0.0, 1.0] and combined into a composite opportunity score.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models import TrendMomentum, TrendScoreResult


@dataclass(frozen=True)
class OpportunityScore:
    """Actionability assessment for a trend."""

    trend_id: str
    trend_name: str
    composite: float  # 0.0 to 1.0
    content: float  # content creation opportunity
    product: float  # product/startup opportunity
    investment: float  # investment signal strength
    reasoning: list[str]


HIGH_SOCIAL_SHARE = 0.45
HIGH_DEVELOPER_SHARE = 0.4
HIGH_SEARCH_SHARE = 0.2
HIGH_EVIDENCE_COUNT = 5
HIGH_SOURCE_DIVERSITY = 3
STRONG_TOTAL_SCORE = 30.0
INVESTMENT_GROWTH_PERCENT = 20.0
INVESTMENT_RANK_CHANGE = 2


def score_opportunities(
    scores: list[TrendScoreResult],
    ranks: dict[str, int],
    momenta: dict[str, TrendMomentum],
    statuses: dict[str, str],
) -> list[OpportunityScore]:
    """Score opportunity for all trends. Returns sorted by composite descending."""

    results: list[OpportunityScore] = []
    for score in scores:
        topic = score.topic
        rank = ranks.get(topic, 99)
        momentum = momenta.get(topic)
        status = statuses.get(topic, "steady")

        result = _score_single(
            topic=topic,
            score=score,
            rank=rank,
            momentum=momentum,
            status=status,
        )
        results.append(result)

    results.sort(key=lambda r: (-r.composite, r.trend_name))
    return results


def _score_single(
    topic: str,
    score: TrendScoreResult,
    rank: int,
    momentum: TrendMomentum | None,
    status: str,
) -> OpportunityScore:
    """Compute opportunity scores for a single trend."""

    reasoning: list[str] = []
    total_score = max(score.total_score, 1.0)
    evidence_count = len(score.evidence)
    source_diversity = len(score.source_counts)
    social_share = score.social_score / total_score
    developer_share = score.developer_score / total_score
    search_share = score.search_score / total_score
    knowledge_share = score.knowledge_score / total_score
    evidence_breadth = min(evidence_count / 6.0, 1.0)
    source_breadth = min(source_diversity / 4.0, 1.0)
    total_score_factor = min(score.total_score / 45.0, 1.0)
    rank_factor = max(0.0, 1.0 - (rank - 1) / 20.0)
    momentum_factor = _momentum_factor(momentum)

    content_score = min(
        1.0,
        social_share * 0.45
        + search_share * 0.25
        + evidence_breadth * 0.2
        + source_breadth * 0.1,
    )
    if social_share >= HIGH_SOCIAL_SHARE and search_share >= HIGH_SEARCH_SHARE:
        reasoning.append(
            f"Strong content angle: social demand and search validation are both elevated ({score.social_score:.0f} social, {score.search_score:.0f} search)"
        )
    elif content_score >= 0.6:
        reasoning.append(f"Strong content angle: broad public conversation across {evidence_count} evidence items")

    product_score = min(
        1.0,
        developer_share * 0.6
        + search_share * 0.08
        + source_breadth * 0.15
        + total_score_factor * 0.14
        + rank_factor * 0.1,
    )
    if developer_share >= HIGH_DEVELOPER_SHARE and source_diversity >= HIGH_SOURCE_DIVERSITY:
        reasoning.append(
            f"Product opportunity: builder demand is leading this trend ({score.developer_score:.0f} developer score across {source_diversity} sources)"
        )
    elif product_score >= 0.6:
        reasoning.append(f"Product opportunity: developer-heavy signal mix with rank #{rank} visibility")

    status_factor = 1.0 if status == "breakout" else 0.7 if status == "rising" else 0.25 if status == "steady" else 0.1
    investment_score = min(
        1.0,
        momentum_factor * 0.48
        + source_breadth * 0.24
        + total_score_factor * 0.14
        + min(knowledge_share / 0.25, 1.0) * 0.04
        + status_factor * 0.06,
    )
    if _has_investment_case(momentum, status, source_diversity, score.total_score):
        reasoning.append(
            f"Investment signal: multi-source validation with real momentum ({source_diversity} sources, {status})"
        )
    elif investment_score >= 0.6:
        reasoning.append("Investment signal: durable cross-source attention with enough velocity to matter")

    composite = content_score * 0.34 + product_score * 0.36 + investment_score * 0.30
    composite = round(min(1.0, composite), 3)

    if not reasoning:
        reasoning.append("Limited actionability signals")

    trend_name = _format_trend_name(topic)

    return OpportunityScore(
        trend_id=_slugify(topic),
        trend_name=trend_name,
        composite=composite,
        content=round(content_score, 3),
        product=round(product_score, 3),
        investment=round(investment_score, 3),
        reasoning=reasoning,
    )


def _slugify(topic: str) -> str:
    normalized = "".join(c.lower() if c.isalnum() else "-" for c in topic)
    return "-".join(part for part in normalized.split("-") if part) or "trend"


def _format_trend_name(topic: str) -> str:
    acronym_map = {
        "ai": "AI",
        "api": "API",
        "sdk": "SDK",
        "ml": "ML",
        "llm": "LLM",
        "b2b": "B2B",
        "b2c": "B2C",
        "ev": "EV",
        "vr": "VR",
        "ar": "AR",
    }
    return " ".join(acronym_map.get(part.lower(), part.capitalize()) for part in topic.split())


def _momentum_factor(momentum: TrendMomentum | None) -> float:
    if momentum is None:
        return 0.0

    percent_factor = 0.0
    if momentum.percent_delta is not None and momentum.percent_delta > 0:
        percent_factor = min(momentum.percent_delta / 50.0, 1.0)

    rank_factor = 0.0
    if momentum.rank_change is not None and momentum.rank_change > 0:
        rank_factor = min(momentum.rank_change / 5.0, 1.0)

    return max(percent_factor, rank_factor)


def _has_investment_case(
    momentum: TrendMomentum | None,
    status: str,
    source_diversity: int,
    total_score: float,
) -> bool:
    if source_diversity < HIGH_SOURCE_DIVERSITY or total_score < STRONG_TOTAL_SCORE:
        return False
    if status not in {"breakout", "rising"}:
        return False
    if momentum is None:
        return False

    percent_ok = (momentum.percent_delta or 0.0) >= INVESTMENT_GROWTH_PERCENT
    rank_ok = (momentum.rank_change or 0) >= INVESTMENT_RANK_CHANGE
    return percent_ok or rank_ok
