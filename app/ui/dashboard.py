"""CLI dashboard rendering."""

from __future__ import annotations

from datetime import datetime, timezone

from app.models import TrendScoreResult


def render_dashboard(scores: list[TrendScoreResult]) -> str:
    """Render a readable CLI table for ranked trends."""

    updated_at = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    lines = [
        "Trend Friend MVP",
        f"Last updated: {updated_at}",
        "",
        "Rank | Topic                  | Score | Social | Dev   | Knowl | Sources",
        "-----+------------------------+-------+--------+-------+-------+--------",
    ]
    for index, score in enumerate(scores, start=1):
        lines.append(
            f"{index:>4} | {score.topic[:22]:<22} | {score.total_score:>5.1f} | "
            f"{score.social_score:>6.1f} | {score.developer_score:>5.1f} | "
            f"{score.knowledge_score:>5.1f} | {','.join(sorted(score.source_counts))}"
        )
        if score.evidence:
            lines.append(f"     Evidence: {score.evidence[0]}")
    return "\n".join(lines)
