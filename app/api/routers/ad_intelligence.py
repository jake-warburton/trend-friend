"""Ad intelligence API endpoints (Pro-gated)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.dependencies import get_db
from app.auth.middleware import require_pro
from app.data.connection import DatabaseConnection
from app.data.repositories import PublishedPayloadRepository, SignalRepository
from app.exports.serializers import build_ad_intelligence_payload
from app.models import UserProfile

LOGGER = logging.getLogger(__name__)

router = APIRouter(tags=["ad-intelligence"])

AD_INTELLIGENCE_PAYLOAD_KEY = "ad-intelligence.json"


@router.get("/ad-intelligence")
def get_ad_intelligence(
    profile: UserProfile = Depends(require_pro),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Return full aggregated ad intelligence payload (Pro only)."""

    payload_repo = PublishedPayloadRepository(db)
    cached = payload_repo.get_payload(AD_INTELLIGENCE_PAYLOAD_KEY)
    if cached is not None:
        return json.loads(cached)

    signal_repo = SignalRepository(db)
    signals = signal_repo.list_signals()
    payload = build_ad_intelligence_payload(
        generated_at=datetime.now(tz=timezone.utc),
        signals=signals,
    )
    return payload.to_dict()


@router.get("/ad-intelligence/keywords")
def get_ad_intelligence_keywords(
    profile: UserProfile = Depends(require_pro),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Return top keywords by CPC and ad density (Pro only)."""

    full = get_ad_intelligence(profile=profile, db=db)
    return {
        "generatedAt": full.get("generatedAt", ""),
        "topKeywords": full.get("topKeywords", []),
    }


@router.get("/ad-intelligence/advertisers")
def get_ad_intelligence_advertisers(
    profile: UserProfile = Depends(require_pro),
    db: DatabaseConnection = Depends(get_db),
) -> dict:
    """Return most active advertisers (Pro only)."""

    full = get_ad_intelligence(profile=profile, db=db)
    return {
        "generatedAt": full.get("generatedAt", ""),
        "topAdvertisers": full.get("topAdvertisers", []),
    }
