"""Scoring weight definitions."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ScoreWeights:
    """Weights used to calculate component scores."""

    social_weight: float = 0.35
    developer_weight: float = 0.3
    knowledge_weight: float = 0.2
    search_weight: float = 0.0
    diversity_weight: float = 4.0


DEFAULT_WEIGHTS = ScoreWeights()
