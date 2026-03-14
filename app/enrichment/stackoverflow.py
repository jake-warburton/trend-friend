"""Stack Overflow tag activity enrichment using the public Stack Exchange API."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.enrichment.base import EnrichmentTarget, MarketMetricEnricher
from app.models import TrendMetricSnapshot


class StackOverflowEnricher(MarketMetricEnricher):
    """Fetch question counts and activity from Stack Overflow's public API."""

    source_name = "stackoverflow"

    def enrich(self, target: EnrichmentTarget, captured_at: datetime) -> list[TrendMetricSnapshot]:
        tag = self._resolve_tag(target)
        if not tag:
            return []
        try:
            return self._fetch_tag_metrics(tag, captured_at)
        except Exception:
            return []

    def _resolve_tag(self, target: EnrichmentTarget) -> str | None:
        """Try to find a matching Stack Overflow tag."""

        candidates = [target.topic.lower().replace(" ", "-")]
        candidates.extend(alias.lower().replace(" ", "-") for alias in target.aliases)
        candidates.append(target.topic.lower().replace(" ", ""))

        for candidate in candidates:
            try:
                payload = self.get_json(
                    self.build_query_url(
                        "https://api.stackexchange.com/2.3/tags",
                        {
                            "inname": candidate,
                            "order": "desc",
                            "sort": "popular",
                            "site": "stackoverflow",
                            "pagesize": "1",
                            "filter": "!nNPvSNVZJS",
                        },
                    )
                )
                items = payload.get("items", [])
                if items and items[0].get("count", 0) > 50:
                    return items[0]["name"]
            except Exception:
                continue
        return None

    def _fetch_tag_metrics(self, tag: str, captured_at: datetime) -> list[TrendMetricSnapshot]:
        """Fetch recent question activity for a Stack Overflow tag."""

        metrics: list[TrendMetricSnapshot] = []
        now = datetime.now(tz=timezone.utc)

        # Get total question count for the tag
        tag_payload = self.get_json(
            self.build_query_url(
                "https://api.stackexchange.com/2.3/tags",
                {
                    "inname": tag,
                    "order": "desc",
                    "sort": "popular",
                    "site": "stackoverflow",
                    "pagesize": "1",
                    "filter": "!nNPvSNVZJS",
                },
            )
        )
        tag_items = tag_payload.get("items", [])
        if tag_items:
            total_count = float(tag_items[0].get("count", 0))
            if total_count > 0:
                metrics.append(
                    TrendMetricSnapshot(
                        source=self.source_name,
                        metric_key="total_questions",
                        label="Stack Overflow questions",
                        value_numeric=total_count,
                        value_display=self.compact_number(total_count),
                        unit="questions",
                        period="all time",
                        captured_at=captured_at,
                        confidence=0.95,
                        provenance_url=f"https://stackoverflow.com/questions/tagged/{tag}",
                        is_estimated=False,
                    )
                )

        # Get questions from the last 30 days to measure recent activity
        from_date = int((now - timedelta(days=30)).timestamp())
        recent_payload = self.get_json(
            self.build_query_url(
                "https://api.stackexchange.com/2.3/questions",
                {
                    "tagged": tag,
                    "fromdate": str(from_date),
                    "order": "desc",
                    "sort": "creation",
                    "site": "stackoverflow",
                    "pagesize": "1",
                    "filter": "total",
                },
            )
        )
        recent_total = float(recent_payload.get("total", 0))
        if recent_total > 0:
            metrics.append(
                TrendMetricSnapshot(
                    source=self.source_name,
                    metric_key="monthly_questions",
                    label="SO questions (30 days)",
                    value_numeric=recent_total,
                    value_display=f"{self.compact_number(recent_total)}/mo",
                    unit="questions",
                    period="last 30 days",
                    captured_at=captured_at,
                    confidence=0.95,
                    provenance_url=f"https://stackoverflow.com/questions/tagged/{tag}?sort=Newest",
                    is_estimated=False,
                )
            )

        # Get previous 30 days for growth rate
        if recent_total > 0:
            try:
                prev_from = int((now - timedelta(days=60)).timestamp())
                prev_to = int((now - timedelta(days=30)).timestamp())
                prev_payload = self.get_json(
                    self.build_query_url(
                        "https://api.stackexchange.com/2.3/questions",
                        {
                            "tagged": tag,
                            "fromdate": str(prev_from),
                            "todate": str(prev_to),
                            "order": "desc",
                            "sort": "creation",
                            "site": "stackoverflow",
                            "pagesize": "1",
                            "filter": "total",
                        },
                    )
                )
                prev_total = float(prev_payload.get("total", 0))
                if prev_total > 0:
                    growth = ((recent_total - prev_total) / prev_total) * 100
                    metrics.append(
                        TrendMetricSnapshot(
                            source=self.source_name,
                            metric_key="question_growth_pct",
                            label="SO question growth",
                            value_numeric=round(growth, 1),
                            value_display=f"{growth:+.1f}%",
                            unit="percent",
                            period="month-over-month",
                            captured_at=captured_at,
                            confidence=0.9,
                            provenance_url=f"https://stackoverflow.com/questions/tagged/{tag}",
                            is_estimated=False,
                        )
                    )
            except Exception:
                pass

        return metrics
