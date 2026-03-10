"""Shared payload builders for watchlist and community responses."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from app.data.repositories import TrendScoreRepository, WatchlistRepository
from app.models import (
    AlertRule,
    TrendGeoSummary,
    TrendScoreResult,
    TrendSourceContribution,
    Watchlist,
    WatchlistItem,
    WatchlistShareEvent,
    WatchlistShare,
)
from app.topics.categorize import categorize_topic

WATCHLIST_SCORE_LOOKUP_LIMIT = 1000


@dataclass(frozen=True)
class _ItemEnrichment:
    rank: int
    rank_change: int | None
    status: str
    category: str
    sources: list[str]
    source_contributions: list[TrendSourceContribution]


def build_watchlist_payload(
    watchlist_repo: WatchlistRepository,
    score_repo: TrendScoreRepository,
    *,
    current_user: dict[str, object] | None = None,
    auth_enabled: bool = False,
) -> dict[str, object]:
    """Build the combined watchlists, shares, alerts, and matches payload."""

    latest_scores = score_repo.list_scores(limit=WATCHLIST_SCORE_LOOKUP_LIMIT)
    score_by_slug = {_slugify(score.topic): score for score in latest_scores}

    watchlists = watchlist_repo.list_watchlists(
        owner_user_id=current_user["id"] if current_user is not None else None,
    )
    alerts = watchlist_repo.list_alert_rules(
        owner_user_id=current_user["id"] if current_user is not None else None,
    )

    return {
        "authEnabled": auth_enabled,
        "currentUser": current_user,
        "watchlists": [
            _serialize_watchlist(
                watchlist,
                watchlist_repo.list_shares_for_watchlist(watchlist.id),
                watchlist_repo.list_share_events_for_watchlist(
                    watchlist.id,
                    owner_user_id=current_user["id"] if current_user is not None else None,
                ),
                score_repo,
                score_by_slug,
                current_user_id=current_user["id"] if current_user is not None else None,
            )
            for watchlist in watchlists
        ],
        "alerts": [_serialize_alert_rule(alert) for alert in alerts],
        "matches": _build_alert_matches(watchlists, alerts, score_by_slug),
    }


def build_shared_watchlist_payload(
    score_repo: TrendScoreRepository,
    share: WatchlistShare,
    watchlist: Watchlist,
    owner_display_name: str | None = None,
) -> dict[str, object]:
    """Build the public payload for a tokenized watchlist share."""

    latest_scores = score_repo.list_scores(limit=WATCHLIST_SCORE_LOOKUP_LIMIT)
    score_by_slug = {_slugify(score.topic): score for score in latest_scores}
    enrichment = _build_enrichment(latest_scores, score_repo)

    return {
        "watchlist": {
            "id": watchlist.id,
            "name": watchlist.name,
            "itemCount": len(watchlist.items),
            "createdAt": _to_utc_iso(watchlist.created_at),
            "updatedAt": _to_utc_iso(watchlist.updated_at),
            "items": [
                _serialize_shared_watchlist_item(
                    item, score_by_slug.get(item.trend_id), score_repo, score_by_slug, enrichment
                )
                for item in watchlist.items
            ],
        },
        "shareToken": share.share_token,
        "public": share.is_public,
        "showCreator": share.show_creator,
        "ownerDisplayName": owner_display_name if share.show_creator else None,
        "expiresAt": _to_utc_iso(share.expires_at) if share.expires_at is not None else None,
        "createdAt": _to_utc_iso(share.created_at),
    }


def build_public_watchlists_payload(
    public_watchlists: list[tuple[Watchlist, WatchlistShare]],
    score_repo: TrendScoreRepository | None = None,
    owner_display_names: dict[int, str] | None = None,
) -> dict[str, object]:
    """Build the public community directory payload."""

    latest_scores = score_repo.list_scores(limit=WATCHLIST_SCORE_LOOKUP_LIMIT) if score_repo else []
    score_by_slug = {_slugify(score.topic): score for score in latest_scores}

    return {
        "watchlists": [
            _serialize_public_watchlist_summary(
                watchlist,
                share,
                score_repo,
                score_by_slug,
                owner_display_name=(owner_display_names or {}).get(share.id),
            )
            for watchlist, share in public_watchlists
        ]
    }


def _serialize_public_watchlist_summary(
    watchlist: Watchlist,
    share: WatchlistShare,
    score_repo: TrendScoreRepository | None,
    score_by_slug: dict[str, object],
    owner_display_name: str | None,
) -> dict[str, object]:
    geo = _aggregate_watchlist_geo(watchlist, score_repo, score_by_slug)
    source_contributions = _aggregate_watchlist_source_contributions(watchlist, score_repo, score_by_slug)
    return {
        "id": watchlist.id,
        "name": watchlist.name,
        "itemCount": len(watchlist.items),
        "shareToken": share.share_token,
        "showCreator": share.show_creator,
        "ownerDisplayName": owner_display_name if share.show_creator else None,
        "expiresAt": _to_utc_iso(share.expires_at) if share.expires_at is not None else None,
        "createdAt": _to_utc_iso(watchlist.created_at),
        "updatedAt": _to_utc_iso(watchlist.updated_at),
        "geoSummary": [_serialize_geo_summary(g) for g in geo],
        "sourceContributions": [_serialize_source_contribution(item) for item in source_contributions],
    }


def _aggregate_watchlist_geo(
    watchlist: Watchlist,
    score_repo: TrendScoreRepository | None,
    score_by_slug: dict[str, object],
    limit: int = 5,
) -> list[TrendGeoSummary]:
    """Aggregate geo signals across all trends in a watchlist."""

    if score_repo is None:
        return []

    combined: dict[str, TrendGeoSummary] = {}
    for item in watchlist.items:
        score = score_by_slug.get(item.trend_id)
        topic = score.topic if score is not None else None
        if topic is None:
            continue
        for geo in score_repo.get_topic_geo_summary(topic):
            key = f"{geo.country_code}|{geo.region}"
            if key in combined:
                existing = combined[key]
                total_signals = existing.signal_count + geo.signal_count
                combined[key] = TrendGeoSummary(
                    label=existing.label,
                    country_code=existing.country_code,
                    region=existing.region,
                    signal_count=total_signals,
                    explicit_count=existing.explicit_count + geo.explicit_count,
                    inferred_count=existing.inferred_count + geo.inferred_count,
                    average_confidence=round(
                        (existing.average_confidence * existing.signal_count + geo.average_confidence * geo.signal_count)
                        / total_signals,
                        2,
                    ),
                )
            else:
                combined[key] = geo

    ranked = sorted(combined.values(), key=lambda g: (-g.signal_count, -g.average_confidence))
    return ranked[:limit]


def _aggregate_watchlist_source_contributions(
    watchlist: Watchlist,
    score_repo: TrendScoreRepository | None,
    score_by_slug: dict[str, object],
    limit: int = 3,
) -> list[TrendSourceContribution]:
    """Aggregate estimated source contribution across all trends in a watchlist."""

    if score_repo is None:
        return []

    combined: dict[str, TrendSourceContribution] = {}
    for item in watchlist.items:
        score = score_by_slug.get(item.trend_id)
        topic = score.topic if score is not None else None
        if topic is None or score is None:
            continue

        for contribution in score_repo.get_topic_source_contributions(topic, score):
            existing = combined.get(contribution.source)
            if existing is None:
                combined[contribution.source] = contribution
                continue

            combined[contribution.source] = TrendSourceContribution(
                source=contribution.source,
                signal_count=existing.signal_count + contribution.signal_count,
                latest_signal_at=max(existing.latest_signal_at, contribution.latest_signal_at),
                estimated_score=round(existing.estimated_score + contribution.estimated_score, 2),
                score_share_percent=0.0,
                social_score=round(existing.social_score + contribution.social_score, 2),
                developer_score=round(existing.developer_score + contribution.developer_score, 2),
                knowledge_score=round(existing.knowledge_score + contribution.knowledge_score, 2),
                search_score=round(existing.search_score + contribution.search_score, 2),
                diversity_score=round(existing.diversity_score + contribution.diversity_score, 2),
            )

    total_estimated_score = sum(item.estimated_score for item in combined.values())
    ranked = sorted(
        (
            TrendSourceContribution(
                source=item.source,
                signal_count=item.signal_count,
                latest_signal_at=item.latest_signal_at,
                estimated_score=item.estimated_score,
                score_share_percent=round((item.estimated_score / total_estimated_score) * 100, 1)
                if total_estimated_score > 0 else 0.0,
                social_score=item.social_score,
                developer_score=item.developer_score,
                knowledge_score=item.knowledge_score,
                search_score=item.search_score,
                diversity_score=item.diversity_score,
            )
            for item in combined.values()
        ),
        key=lambda item: (-item.estimated_score, -item.signal_count, item.source),
    )
    return ranked[:limit]


def _build_enrichment(
    ordered_scores: list[TrendScoreResult],
    score_repo: TrendScoreRepository,
) -> dict[str, _ItemEnrichment]:
    """Build rank, status, category, and source data for each scored trend."""

    result: dict[str, _ItemEnrichment] = {}
    for rank, score in enumerate(ordered_scores, start=1):
        slug = _slugify(score.topic)
        history = score_repo.get_topic_history(score.topic, limit_runs=2)
        momentum = TrendScoreRepository._build_momentum(score.total_score, history)
        status = TrendScoreRepository._build_trend_status(momentum)
        result[slug] = _ItemEnrichment(
            rank=rank,
            rank_change=momentum.rank_change,
            status=status,
            category=categorize_topic(score.topic, score.source_counts),
            sources=sorted(score.source_counts),
            source_contributions=score_repo.get_topic_source_contributions(score.topic, score),
        )
    return result


def _build_alert_matches(
    watchlists: list[Watchlist],
    alerts: list[AlertRule],
    score_by_slug: dict[str, object],
) -> list[dict[str, object]]:
    matches: list[dict[str, object]] = []
    for alert in alerts:
        watchlist = next((item for item in watchlists if item.id == alert.watchlist_id), None)
        if watchlist is None or not alert.enabled:
            continue
        for item in watchlist.items:
            score = score_by_slug.get(item.trend_id)
            if score is None:
                continue
            if alert.rule_type == "score_above" and score.total_score >= alert.threshold:
                matches.append(
                    {
                        "alertId": alert.id,
                        "alertName": alert.name,
                        "watchlistId": watchlist.id,
                        "trendId": item.trend_id,
                        "trendName": item.trend_name,
                        "ruleType": alert.rule_type,
                        "threshold": alert.threshold,
                        "currentValue": round(score.total_score, 1),
                    }
                )
    return matches


def _serialize_watchlist(
    watchlist: Watchlist,
    shares: list[WatchlistShare],
    share_events: list[WatchlistShareEvent],
    score_repo: TrendScoreRepository,
    score_by_slug: dict[str, object],
    current_user_id: int | None,
) -> dict[str, object]:
    return {
        "id": watchlist.id,
        "name": watchlist.name,
        "ownerUserId": watchlist.owner_user_id,
        "ownedByCurrentUser": current_user_id is not None and watchlist.owner_user_id == current_user_id,
        "createdAt": _to_utc_iso(watchlist.created_at),
        "updatedAt": _to_utc_iso(watchlist.updated_at),
        "items": [
            _serialize_watchlist_item(item, score_repo, score_by_slug)
            for item in watchlist.items
        ],
        "shares": [
            {
                "id": share.id,
                "shareToken": share.share_token,
                "public": share.is_public,
                "showCreator": share.show_creator,
                "expiresAt": _to_utc_iso(share.expires_at) if share.expires_at is not None else None,
                "createdAt": _to_utc_iso(share.created_at),
            }
            for share in shares
        ],
        "shareEvents": [
            {
                "id": event.id,
                "shareId": event.share_id,
                "eventType": event.event_type,
                "detail": event.detail,
                "createdAt": _to_utc_iso(event.created_at),
            }
            for event in share_events
        ],
    }


def _serialize_watchlist_item(
    item: WatchlistItem,
    score_repo: TrendScoreRepository,
    score_by_slug: dict[str, object],
) -> dict[str, object]:
    score = score_by_slug.get(item.trend_id)
    topic = score.topic if score is not None else None
    geo = score_repo.get_topic_geo_summary(topic) if topic else []
    return {
        "trendId": item.trend_id,
        "trendName": item.trend_name,
        "addedAt": _to_utc_iso(item.added_at),
        "geoSummary": [_serialize_geo_summary(g) for g in geo],
    }


def _serialize_shared_watchlist_item(
    item: WatchlistItem,
    score: TrendScoreResult | None,
    score_repo: TrendScoreRepository,
    score_by_slug: dict[str, object],
    enrichment: dict[str, _ItemEnrichment] | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = _serialize_watchlist_item(item, score_repo, score_by_slug)
    payload["currentScore"] = round(score.total_score, 1) if score is not None else None

    info = enrichment.get(item.trend_id) if enrichment else None
    if info is not None:
        payload["rank"] = info.rank
        payload["rankChange"] = info.rank_change
        payload["status"] = info.status
        payload["category"] = info.category
        payload["sources"] = info.sources
        payload["sourceContributions"] = [
            _serialize_source_contribution(item)
            for item in info.source_contributions
        ]
    else:
        payload["rank"] = None
        payload["rankChange"] = None
        payload["status"] = None
        payload["category"] = None
        payload["sources"] = []
        payload["sourceContributions"] = []

    return payload


def _serialize_geo_summary(geo: TrendGeoSummary) -> dict[str, object]:
    return {
        "label": geo.label,
        "countryCode": geo.country_code,
        "region": geo.region,
        "signalCount": geo.signal_count,
        "explicitCount": geo.explicit_count,
        "inferredCount": geo.inferred_count,
        "averageConfidence": geo.average_confidence,
    }


def _serialize_source_contribution(contribution: TrendSourceContribution) -> dict[str, object]:
    return {
        "source": contribution.source,
        "signalCount": contribution.signal_count,
        "latestSignalAt": _to_utc_iso(contribution.latest_signal_at),
        "estimatedScore": round(contribution.estimated_score, 1),
        "scoreSharePercent": contribution.score_share_percent,
        "score": {
            "total": round(contribution.estimated_score, 1),
            "social": round(contribution.social_score, 1),
            "developer": round(contribution.developer_score, 1),
            "knowledge": round(contribution.knowledge_score, 1),
            "search": round(contribution.search_score, 1),
            "diversity": round(contribution.diversity_score, 1),
        },
    }


def _serialize_alert_rule(alert: AlertRule) -> dict[str, object]:
    return {
        "id": alert.id,
        "watchlistId": alert.watchlist_id,
        "name": alert.name,
        "ruleType": alert.rule_type,
        "threshold": alert.threshold,
        "enabled": alert.enabled,
        "createdAt": _to_utc_iso(alert.created_at),
    }


def _to_utc_iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _slugify(topic: str) -> str:
    normalized = "".join(character.lower() if character.isalnum() else "-" for character in topic)
    compact = "-".join(part for part in normalized.split("-") if part)
    return compact or "trend"
