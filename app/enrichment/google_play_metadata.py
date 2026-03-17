"""Google Play Store metadata enrichment via google-play-scraper."""

from __future__ import annotations

import json
from datetime import datetime

from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.models import TrendMetricSnapshot


class GooglePlayMetadataEnricher(MarketMetricEnricher):
    """Fetch app metadata from Google Play Store (free, no key required)."""

    source_name = "google_play"

    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        app_id = self._resolve_app_id(target)
        if not app_id:
            return []
        try:
            return self._fetch_metadata(app_id, captured_at)
        except Exception:
            return []

    def _resolve_app_id(self, target: EnrichmentTarget) -> str | None:
        """Extract Google Play app ID from topic or aliases."""
        for candidate in [target.topic] + target.aliases:
            candidate = candidate.strip()
            # Google Play app IDs look like com.example.app
            if "." in candidate and not candidate.startswith("http"):
                return candidate
        # Try searching via google-play-scraper
        try:
            import google_play_scraper as gplay
            results = gplay.search(target.name, n_hits=1, lang="en", country="us")
            if results:
                return str(results[0].get("appId", ""))
        except Exception:
            pass
        return None

    def _fetch_metadata(self, app_id: str, captured_at: datetime) -> list[TrendMetricSnapshot]:
        """Fetch and parse app metadata from Google Play."""
        try:
            import google_play_scraper as gplay
        except ImportError:
            return []

        app = gplay.app(app_id, lang="en", country="us")
        if not app:
            return []

        metrics: list[TrendMetricSnapshot] = []
        store_url = f"https://play.google.com/store/apps/details?id={app_id}"

        # Rating
        rating = app.get("score")
        if rating is not None:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="google_play_rating",
                label="Google Play rating",
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
        rating_count = app.get("ratings")
        if rating_count and int(rating_count) > 0:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="google_play_rating_count",
                label="Google Play ratings",
                value_numeric=float(rating_count),
                value_display=self.compact_number(float(rating_count)),
                unit="ratings",
                period="all time",
                captured_at=captured_at,
                confidence=0.95,
                provenance_url=store_url,
                is_estimated=False,
            ))

        # Installs
        installs = app.get("installs")
        if installs:
            # Parse install string like "10,000,000+" to numeric
            install_str = str(installs)
            install_numeric = float(install_str.replace(",", "").replace("+", "") or 0)
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="google_play_installs",
                label="Google Play installs",
                value_numeric=install_numeric,
                value_display=str(installs),
                unit="installs",
                period="all time",
                captured_at=captured_at,
                confidence=0.80,
                provenance_url=store_url,
                is_estimated=True,
            ))

        # Price
        price = app.get("price", 0)
        if price is not None:
            price_val = float(price)
            display = "Free" if price_val == 0 else f"${price_val:.2f}"
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="google_play_price",
                label="Google Play price",
                value_numeric=price_val,
                value_display=display,
                unit="USD",
                period="current",
                captured_at=captured_at,
                confidence=0.95,
                provenance_url=store_url,
                is_estimated=False,
            ))

        # Contains ads
        contains_ads = app.get("adSupported")
        if contains_ads is not None:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="google_play_contains_ads",
                label="Contains ads",
                value_numeric=1.0 if contains_ads else 0.0,
                value_display="Yes" if contains_ads else "No",
                unit="boolean",
                period="current",
                captured_at=captured_at,
                confidence=0.95,
                provenance_url=store_url,
                is_estimated=False,
            ))

        # In-app purchases
        has_iap = app.get("offersIAP")
        if has_iap is not None:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="google_play_has_iap",
                label="In-app purchases",
                value_numeric=1.0 if has_iap else 0.0,
                value_display="Yes" if has_iap else "No",
                unit="boolean",
                period="current",
                captured_at=captured_at,
                confidence=0.95,
                provenance_url=store_url,
                is_estimated=False,
            ))

        # Description (truncated)
        description = str(app.get("description", ""))[:500]
        if description:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="google_play_description",
                label="Google Play description",
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
        icon_url = str(app.get("icon", ""))
        if icon_url:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="google_play_icon_url",
                label="Google Play icon",
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
        screenshots = app.get("screenshots", [])
        if screenshots:
            metrics.append(TrendMetricSnapshot(
                source=self.source_name,
                metric_key="google_play_screenshots",
                label="Google Play screenshots",
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
