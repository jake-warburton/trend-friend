"""Scoring weight definitions."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ScoreWeights:
    """Weights used to calculate component scores."""

    social_weight: float = 0.3
    developer_weight: float = 0.25
    knowledge_weight: float = 0.15
    search_weight: float = 0.2
    diversity_weight: float = 6.0


DEFAULT_WEIGHTS = ScoreWeights()
