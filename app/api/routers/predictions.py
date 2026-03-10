"""Breakout prediction API route."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.dependencies import get_db, get_settings
from app.data.repositories import TrendScoreRepository
from app.scoring.predictor import predict_breakouts

router = APIRouter(tags=["predictions"])


@router.get("/predictions/breakout")
def get_breakout_predictions(db: sqlite3.Connection = Depends(get_db)) -> dict:
    """Return breakout predictions for current trends."""

    settings = get_settings()
    repository = TrendScoreRepository(db)
    _, latest_scores = repository.list_latest_snapshot(limit=settings.ranking_limit)
    if not latest_scores:
        return {"predictions": [], "generatedAt": datetime.now(tz=timezone.utc).isoformat()}

    now = datetime.now(tz=timezone.utc)
    histories = {}
    current_ranks = {}
    first_seen = {}

    for rank, score in enumerate(latest_scores, start=1):
        topic = score.topic
        current_ranks[topic] = rank
        histories[topic] = repository.get_topic_history(topic, limit_runs=6)
        first_seen[topic] = repository.get_first_seen_at(topic)

    predictions = predict_breakouts(
        current_scores=latest_scores,
        histories=histories,
        current_ranks=current_ranks,
        first_seen=first_seen,
        now=now,
    )

    return {
        "generatedAt": now.isoformat(),
        "predictions": [
            {
                "trendId": p.trend_id,
                "trendName": p.trend_name,
                "confidence": p.confidence,
                "signals": p.signals,
                "currentScore": p.current_score,
                "predictedDirection": p.predicted_direction,
            }
            for p in predictions
        ],
    }
