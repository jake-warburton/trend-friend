"""Google search metric enrichment."""

from __future__ import annotations

from datetime import datetime

from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.models import TrendMetricSnapshot


class GoogleSearchMetricsEnricher(MarketMetricEnricher):
    """Fetch Google search metrics from a configured provider or deterministic fallback."""

    source_name = "google_search"

    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        if self.settings.google_search_metrics_url:
            try:
                return self._enrich_from_provider(target, captured_at)
            except Exception:
                pass
        return self._fallback_metrics(target, captured_at)

    def _enrich_from_provider(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        query = target.name or target.topic
        headers = {}
        if self.settings.google_search_metrics_token:
            headers["Authorization"] = f"Bearer {self.settings.google_search_metrics_token}"
        payload = self.get_json(
            self.build_query_url(self.settings.google_search_metrics_url or "", {"q": query}),
            headers=headers,
        )
        monthly_searches = float(payload.get("monthlySearches", 0))
        search_interest = float(payload.get("searchInterest", 0))
        source_url = payload.get("sourceUrl")
        metrics: list[TrendMetricSnapshot] = []
        if monthly_searches > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="monthly_searches",
                    label="Monthly Google searches",
                    value_numeric=monthly_searches,
                    value_display=f"{self.compact_number(monthly_searches)}/mo",
                    unit="searches",
                    period="last 30 days",
                    captured_at=captured_at,
                    confidence=0.94,
                    provenance_url=str(source_url) if source_url else None,
                    is_estimated=False,
                )
            )
        if search_interest > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="search_interest",
                    label="Google search interest",
                    value_numeric=search_interest,
                    value_display=f"{round(search_interest):.0f}/100",
                    unit="index",
                    period="12 months",
                    captured_at=captured_at,
                    confidence=0.9,
                    provenance_url=str(source_url) if source_url else None,
                    is_estimated=False,
                )
            )
        return metrics

    def _fallback_metrics(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        seed = self.hashed_seed(target.topic)
        monthly_searches = float(20_000 + (seed % 480_000))
        interest = float(25 + seed % 70)
        return [
            TrendMetricSnapshot(
                source=self.source_name,
                metric_key="monthly_searches",
                label="Monthly Google searches",
                value_numeric=monthly_searches,
                value_display=f"{self.compact_number(monthly_searches)}/mo",
                unit="searches",
                period="monthly",
                captured_at=captured_at,
                confidence=0.35,
                provenance_url=None,
                is_estimated=True,
            ),
            TrendMetricSnapshot(
                source=self.source_name,
                metric_key="search_interest",
                label="Google search interest",
                value_numeric=interest,
                value_display=f"{round(interest):.0f}/100",
                unit="index",
                period="12 months",
                captured_at=captured_at,
                confidence=0.35,
                provenance_url=None,
                is_estimated=True,
            ),
        ]
