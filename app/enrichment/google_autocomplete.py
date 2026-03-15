"""Google Autocomplete enrichment — free related-search suggestions."""

from __future__ import annotations

from datetime import datetime
from urllib.parse import quote_plus

from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.models import TrendMetricSnapshot


class GoogleAutocompleteEnricher(MarketMetricEnricher):
    """Fetch related search suggestions from Google's free autocomplete API.

    Queries multiple variants of the topic name to build a broad set of
    related searches, similar to Treendly's related-query panels.  No API
    key is required — the ``client=firefox`` parameter returns clean JSON.
    """

    source_name = "google_search"

    _AUTOCOMPLETE_BASE = "https://suggestqueries.google.com/complete/search"

    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        query = target.name or target.topic
        try:
            suggestions = self._collect_suggestions(query)
        except Exception:
            return []

        if not suggestions:
            return []

        provenance = f"https://www.google.com/search?q={quote_plus(query)}"
        return self._build_metrics(suggestions, captured_at, provenance)

    # ------------------------------------------------------------------
    # Data collection
    # ------------------------------------------------------------------

    def _collect_suggestions(self, query: str) -> list[str]:
        """Query multiple autocomplete variants and return deduplicated suggestions."""

        query_variants = [
            query,
            f"what is {query}",
            f"{query} vs",
            f"{query} how to",
        ]

        seen: set[str] = set()
        suggestions: list[str] = []
        query_lower = query.lower()

        for variant in query_variants:
            try:
                results = self._fetch_completions(variant)
            except Exception:
                continue
            for suggestion in results:
                normalised = suggestion.strip().lower()
                if normalised == query_lower:
                    continue
                if normalised not in seen:
                    seen.add(normalised)
                    suggestions.append(suggestion.strip())

        return suggestions[:15]

    def _fetch_completions(self, query: str) -> list[str]:
        """Fetch autocomplete suggestions for a single query string."""

        url = self.build_query_url(
            self._AUTOCOMPLETE_BASE,
            {"client": "firefox", "q": query},
        )
        payload = self.get_json(url)

        # Response format: [query, [suggestion1, suggestion2, ...]]
        if isinstance(payload, list) and len(payload) >= 2 and isinstance(payload[1], list):
            return [s for s in payload[1] if isinstance(s, str)]
        return []

    # ------------------------------------------------------------------
    # Metric construction
    # ------------------------------------------------------------------

    def _build_metrics(
        self,
        suggestions: list[str],
        captured_at: datetime,
        provenance: str,
    ) -> list[TrendMetricSnapshot]:
        count = len(suggestions)
        display = ", ".join(suggestions)

        return [
            self._snapshot(
                metric_key="related_searches",
                label="Related Google searches",
                value_numeric=float(count),
                value_display=display,
                unit="queries",
                period="current",
                captured_at=captured_at,
                confidence=0.82,
                provenance_url=provenance,
                is_estimated=False,
            ),
            self._snapshot(
                metric_key="search_depth",
                label="Search ecosystem depth",
                value_numeric=float(count),
                value_display=f"{count} related searches",
                unit="count",
                period="current",
                captured_at=captured_at,
                confidence=0.75,
                provenance_url=provenance,
                is_estimated=True,
            ),
        ]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

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
