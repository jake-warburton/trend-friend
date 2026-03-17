"""Apple App Store metadata enrichment via iTunes Lookup API."""

from __future__ import annotations

import json
from datetime import datetime

from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.models import TrendMetricSnapshot


class AppStoreMetadataEnricher(MarketMetricEnricher):
    """Fetch app metadata from the iTunes Lookup API (free, no key required)."""

    source_name = "apple_charts"

    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        app_id = self._resolve_app_id(target)
        if not app_id:
            return []
        try:
            return self._fetch_metadata(app_id, captured_at)
        except Exception:
            return []

    def _resolve_app_id(self, target: EnrichmentTarget) -> str | None:
        """Extract Apple app ID from topic name or aliases."""
        # App IDs are typically numeric strings stored during ingestion
        # Check if any alias looks like an Apple app ID
        for candidate in [target.topic] + target.aliases:
            candidate = candidate.strip()
            if candidate.isdigit():
                return candidate
        # Try searching iTunes for the app name
        try:
            search_url = self.build_query_url(
                "https://itunes.apple.com/search",
                {"term": target.name, "entity": "software", "limit": "1", "country": "us"},
            )
            data = self.get_json(search_url)
            results = data.get("results", [])
            if results:
                return str(results[0].get("trackId", ""))
        except Exception:
            pass
        return None

    def _fetch_metadata(self, app_id: str, captured_at: datetime) -> list[TrendMetricSnapshot]:
        """Fetch and parse app metadata from iTunes Lookup API."""
        url = f"https://itunes.apple.com/lookup?id={app_id}&country=us"
        data = self.get_json(url)
        results = data.get("results", [])
        if not results:
            return []

        app = results[0]
        metrics: list[TrendMetricSnapshot] = []
        store_url = str(app.get("trackViewUrl", ""))

        # Rating
        rating = app.get("averageUserRating")
        if rating is not None:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="app_store_rating",
                label="App Store rating",
                value_numeric=round(float(rating), 1),
                value_display=f"{float(rating):.1f} ★",
                unit="stars",
                period="all time",
                captured_at=captured_at,
                confidence=0.95,
                provenance_url=store_url,
                is_estimated=False,
            ))

        # Rating count
        rating_count = app.get("userRatingCount")
        if rating_count and int(rating_count) > 0:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="app_store_rating_count",
                label="App Store ratings",
                value_numeric=float(rating_count),
                value_display=self.compact_number(float(rating_count)),
                unit="ratings",
                period="all time",
                captured_at=captured_at,
                confidence=0.95,
                provenance_url=store_url,
                is_estimated=False,
            ))

        # Price
        price = app.get("price")
        if price is not None:
            price_val = float(price)
            display = "Free" if price_val == 0 else f"${price_val:.2f}"
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="app_store_price",
                label="App Store price",
                value_numeric=price_val,
                value_display=display,
                unit="USD",
                period="current",
                captured_at=captured_at,
                confidence=0.95,
                provenance_url=store_url,
                is_estimated=False,
            ))

        # Genre
        genre = app.get("primaryGenreName")
        if genre:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="app_store_genre",
                label="App Store genre",
                value_numeric=0.0,
                value_display=str(genre),
                unit="category",
                period="current",
                captured_at=captured_at,
                confidence=0.95,
                provenance_url=store_url,
                is_estimated=False,
            ))

        # In-app purchases
        advisories = app.get("advisories", [])
        iap_advisories = [a for a in advisories if "purchase" in str(a).lower()]
        has_iap = bool(iap_advisories) or bool(app.get("isVppDeviceBasedLicensingEnabled"))
        # IAP detection from iTunes API is limited; record only if detected
        if has_iap:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="app_store_has_iap",
                label="In-app purchases",
                value_numeric=1.0,
                value_display="Yes",
                unit="boolean",
                period="current",
                captured_at=captured_at,
                confidence=0.80,
                provenance_url=store_url,
                is_estimated=True,
            ))

        # Description (truncated)
        description = str(app.get("description", ""))[:500]
        if description:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="app_store_description",
                label="App Store description",
                value_numeric=0.0,
                value_display=description[:200] + ("..." if len(description) > 200 else ""),
                unit="text",
                period="current",
                captured_at=captured_at,
                confidence=0.95,
                provenance_url=store_url,
                is_estimated=False,
            ))

        # Icon URL
        icon_url = str(app.get("artworkUrl512", app.get("artworkUrl100", "")))
        if icon_url:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="app_store_icon_url",
                label="App Store icon",
                value_numeric=0.0,
                value_display=icon_url,
                unit="url",
                period="current",
                captured_at=captured_at,
                confidence=0.95,
                provenance_url=store_url,
                is_estimated=False,
            ))

        # Screenshots
        screenshots = app.get("screenshotUrls", [])
        if screenshots:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="app_store_screenshots",
                label="App Store screenshots",
                value_numeric=float(len(screenshots)),
                value_display=json.dumps(screenshots[:5]),
                unit="urls",
                period="current",
                captured_at=captured_at,
                confidence=0.95,
                provenance_url=store_url,
                is_estimated=False,
            ))

        return metrics
