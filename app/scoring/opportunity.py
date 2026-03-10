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

    # Content opportunity: social signal strength + evidence breadth
    social_ratio = score.social_score / max(score.total_score, 1.0)
    evidence_count = len(score.evidence)
    content_score = min(1.0, (social_ratio * 0.5) + (min(evidence_count, 8) / 8.0 * 0.3) + (0.2 if evidence_count >= 3 else 0.0))
    if content_score >= 0.6:
        reasoning.append(f"Strong content play (social {score.social_score:.0f}, {evidence_count} evidence items)")

    # Product opportunity: developer signal + absolute score + rank
    dev_ratio = score.developer_score / max(score.total_score, 1.0)
    rank_factor = max(0.0, 1.0 - (rank - 1) / 25.0)
    product_score = min(1.0, dev_ratio * 0.4 + rank_factor * 0.3 + min(score.total_score / 50.0, 1.0) * 0.3)
    if product_score >= 0.6:
        reasoning.append(f"Product opportunity (dev {score.developer_score:.0f}, rank #{rank})")

    # Investment signal: growth velocity + multi-source validation
    growth_factor = 0.0
    if momentum is not None:
        if momentum.percent_delta is not None and momentum.percent_delta > 0:
            growth_factor = min(momentum.percent_delta / 50.0, 1.0)
        if momentum.rank_change is not None and momentum.rank_change > 0:
            growth_factor = max(growth_factor, min(momentum.rank_change / 5.0, 1.0))

    source_diversity = min(len(score.source_counts) / 4.0, 1.0)
    status_boost = 0.3 if status == "breakout" else (0.15 if status == "rising" else 0.0)
    investment_score = min(1.0, growth_factor * 0.4 + source_diversity * 0.3 + status_boost + 0.0)
    if investment_score >= 0.5:
        reasoning.append(f"Investment signal ({len(score.source_counts)} sources, {status})")

    # Composite: weighted average
    composite = content_score * 0.3 + product_score * 0.35 + investment_score * 0.35
    composite = round(min(1.0, composite), 3)

    if not reasoning:
        reasoning.append("Limited actionability signals")

    trend_name = " ".join(
        part.upper() if len(part) <= 3 else part.capitalize()
        for part in topic.split()
    )

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
