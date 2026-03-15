"""Scoring weight definitions."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ScoreWeights:
    """Weights used to calculate component scores."""

    social_weight: float = 0.28
    developer_weight: float = 0.23
    knowledge_weight: float = 0.14
    search_weight: float = 0.18
    advertising_weight: float = 0.15
    diversity_weight: float = 6.0


DEFAULT_WEIGHTS = ScoreWeights()
