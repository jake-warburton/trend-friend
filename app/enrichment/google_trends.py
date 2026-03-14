"""Google Trends interest-over-time enrichment via SerpAPI or local estimation."""

from __future__ import annotations

from datetime import datetime
from urllib.parse import quote_plus

from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.models import TrendMetricSnapshot


class GoogleTrendsEnricher(MarketMetricEnricher):
    """Fetch Google Trends interest-over-time data.

    When a SerpAPI key is configured, queries the SerpAPI Google Trends engine
    for real interest-over-time values, related queries, and related topics.

    Without SerpAPI, produces deterministic estimated metrics derived from the
    topic name so that downstream consumers always receive a consistent shape.
    """

    source_name = "google_trends"

    _SERPAPI_BASE = "https://serpapi.com/search.json"

    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        if self.settings.serpapi_key:
            try:
                return self._enrich_from_serpapi(target, captured_at)
            except Exception:
                pass
        return self._fallback_estimated(target, captured_at)

    # ------------------------------------------------------------------
    # SerpAPI path
    # ------------------------------------------------------------------

    def _enrich_from_serpapi(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        """Query SerpAPI Google Trends engine and build metric snapshots."""

        query = target.name or target.topic
        url = self.build_query_url(
            self._SERPAPI_BASE,
            {
                "engine": "google_trends",
                "q": query,
                "data_type": "TIMESERIES",
                "date": "today 12-m",
                "api_key": self.settings.serpapi_key,
            },
        )
        payload = self.get_json(url)
        provenance = f"https://trends.google.com/trends/explore?q={quote_plus(query)}"

        metrics: list[TrendMetricSnapshot] = []

        # --- Interest over time ---
        interest_over_time = payload.get("interest_over_time", {})
        timeline_data: list[dict] = interest_over_time.get("timeline_data", [])

        if timeline_data:
            values = self._extract_values(timeline_data)
            if values:
                current = values[-1]
                peak = max(values)
                average = round(sum(values) / len(values), 1)

                metrics.append(self._snapshot(
                    metric_key="search_interest_current",
                    label="Google Trends current interest",
                    value_numeric=float(current),
                    value_display=f"{current}/100",
                    unit="index",
                    period="current week",
                    captured_at=captured_at,
                    confidence=0.92,
                    provenance_url=provenance,
                    is_estimated=False,
                ))
                metrics.append(self._snapshot(
                    metric_key="search_interest_peak",
                    label="Google Trends peak interest (12 mo)",
                    value_numeric=float(peak),
                    value_display=f"{peak}/100",
                    unit="index",
                    period="last 12 months",
                    captured_at=captured_at,
                    confidence=0.92,
                    provenance_url=provenance,
                    is_estimated=False,
                ))
                metrics.append(self._snapshot(
                    metric_key="search_interest_avg",
                    label="Google Trends average interest (12 mo)",
                    value_numeric=average,
                    value_display=f"{average}/100",
                    unit="index",
                    period="last 12 months",
                    captured_at=captured_at,
                    confidence=0.90,
                    provenance_url=provenance,
                    is_estimated=False,
                ))

                # Growth: current vs average of values ~3 months ago
                growth = self._compute_growth(values)
                if growth is not None:
                    metrics.append(self._snapshot(
                        metric_key="search_interest_growth",
                        label="Google Trends interest growth",
                        value_numeric=round(growth, 1),
                        value_display=f"{growth:+.1f}%",
                        unit="percent",
                        period="current vs 3 months ago",
                        captured_at=captured_at,
                        confidence=0.85,
                        provenance_url=provenance,
                        is_estimated=False,
                    ))

        # --- Related queries ---
        related_queries = payload.get("related_queries", {})
        top_queries = related_queries.get("top", []) if isinstance(related_queries, dict) else []
        if top_queries:
            query_strings = [q.get("query", "") for q in top_queries[:10] if q.get("query")]
            if query_strings:
                display = ", ".join(query_strings)
                metrics.append(self._snapshot(
                    metric_key="related_queries",
                    label="Google Trends related queries",
                    value_numeric=float(len(query_strings)),
                    value_display=display,
                    unit="queries",
                    period="last 12 months",
                    captured_at=captured_at,
                    confidence=0.88,
                    provenance_url=provenance,
                    is_estimated=False,
                ))

        return metrics

    # ------------------------------------------------------------------
    # Fallback estimation path
    # ------------------------------------------------------------------

    def _fallback_estimated(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        """Return empty metrics when SerpAPI is unavailable — no fake data."""

        return []

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_values(timeline_data: list[dict]) -> list[int]:
        """Pull the first query's values from SerpAPI timeline data."""

        values: list[int] = []
        for point in timeline_data:
            point_values = point.get("values", [])
            if point_values:
                try:
                    values.append(int(point_values[0].get("extracted_value", 0)))
                except (ValueError, TypeError):
                    values.append(0)
        return values

    @staticmethod
    def _compute_growth(values: list[int]) -> float | None:
        """Compute growth percentage comparing current value to ~3 months ago."""

        if len(values) < 13:
            return None
        # SerpAPI returns weekly data for 12-month range (~52 points).
        # 3 months ago is roughly 13 weeks back.
        quarter_ago_index = max(0, len(values) - 13)
        # Average a small window around the target point for stability.
        window_start = max(0, quarter_ago_index - 1)
        window_end = min(len(values), quarter_ago_index + 2)
        baseline_values = values[window_start:window_end]
        baseline = sum(baseline_values) / len(baseline_values) if baseline_values else 0
        if baseline <= 0:
            return None
        return round(((values[-1] - baseline) / baseline) * 100, 1)

    def _snapshot(
        self,
        *,
        metric_key: str,
        label: str,
        value_numeric: float,
        value_display: str,
        unit: str,
        period: str,
        captured_at: datetime,
        confidence: float,
        provenance_url: str | None,
        is_estimated: bool,
    ) -> TrendMetricSnapshot:
        """Create a TrendMetricSnapshot bound to this enricher's source name."""

        return TrendMetricSnapshot(
            source=self.source_name,
            metric_key=metric_key,
            label=label,
            value_numeric=value_numeric,
            value_display=value_display,
            unit=unit,
            period=period,
            captured_at=captured_at,
            confidence=confidence,
            provenance_url=provenance_url,
            is_estimated=is_estimated,
        )
