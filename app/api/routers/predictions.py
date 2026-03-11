"""Breakout prediction API route."""

from __future__ import annotations
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.dependencies import get_db, get_settings
from app.data.connection import DatabaseConnection
from app.data.repositories import TrendScoreRepository
from app.scoring.opportunity import score_opportunities
from app.scoring.predictor import predict_breakouts

router = APIRouter(tags=["predictions"])


@router.get("/predictions/breakout")
def get_breakout_predictions(db: DatabaseConnection = Depends(get_db)) -> dict:
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
    seasonality_by_topic = {}

    for rank, score in enumerate(latest_scores, start=1):
        topic = score.topic
        current_ranks[topic] = rank
        histories[topic] = repository.get_topic_history(topic, limit_runs=6)
        first_seen[topic] = repository.get_first_seen_at(topic)
        seasonality = repository.get_topic_seasonality(topic)
        seasonality_by_topic[topic] = seasonality if seasonality.tag is not None else None

    predictions = predict_breakouts(
        current_scores=latest_scores,
        histories=histories,
        current_ranks=current_ranks,
        first_seen=first_seen,
        now=now,
        seasonality_by_topic=seasonality_by_topic,
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


@router.get("/predictions/opportunity")
def get_opportunity_scores(db: DatabaseConnection = Depends(get_db)) -> dict:
    """Return opportunity/actionability scores for current trends."""

    settings = get_settings()
    repository = TrendScoreRepository(db)
    _, latest_scores = repository.list_latest_snapshot(limit=settings.ranking_limit)
    if not latest_scores:
        return {"opportunities": [], "generatedAt": datetime.now(tz=timezone.utc).isoformat()}

    now = datetime.now(tz=timezone.utc)
    explorer_records = repository.list_trend_explorer_records(limit=settings.ranking_limit)

    ranks = {r.score.topic: r.rank for r in explorer_records}
    momenta = {r.score.topic: r.momentum for r in explorer_records}
    statuses = {r.score.topic: r.status for r in explorer_records}

    opportunities = score_opportunities(
        scores=latest_scores,
        ranks=ranks,
        momenta=momenta,
        statuses=statuses,
    )

    return {
        "generatedAt": now.isoformat(),
        "opportunities": [
            {
                "trendId": o.trend_id,
                "trendName": o.trend_name,
                "composite": o.composite,
                "content": o.content,
                "product": o.product,
                "investment": o.investment,
                "reasoning": o.reasoning,
            }
            for o in opportunities
        ],
    }
