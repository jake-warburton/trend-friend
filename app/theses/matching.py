"""Pure thesis matching helpers."""

from __future__ import annotations

from dataclasses import dataclass

from app.models import TrendDetailRecord, TrendThesis


@dataclass(frozen=True)
class ThesisMatchCandidate:
    """One scored thesis match against a current trend record."""

    thesis_id: int
    trend_id: str
    trend_name: str
    lens_score: float
    total_score: float


def match_trends_to_theses(
    theses: list[TrendThesis],
    detail_records: list[TrendDetailRecord],
) -> dict[int, list[ThesisMatchCandidate]]:
    """Return thesis matches keyed by thesis id."""

    matches: dict[int, list[ThesisMatchCandidate]] = {}
    for thesis in theses:
        thesis_matches: list[ThesisMatchCandidate] = []
        for detail in detail_records:
            if not trend_matches_thesis(detail, thesis):
                continue
            thesis_matches.append(
                ThesisMatchCandidate(
                    thesis_id=thesis.id,
                    trend_id=detail.id,
                    trend_name=detail.name,
                    lens_score=round(get_thesis_lens_score(detail, thesis.lens), 1),
                    total_score=round(detail.score.total_score, 1),
                )
            )
        thesis_matches.sort(key=lambda item: (-item.lens_score, -item.total_score, item.trend_name))
        matches[thesis.id] = thesis_matches
    return matches


def trend_matches_thesis(detail: TrendDetailRecord, thesis: TrendThesis) -> bool:
    """Check whether one trend detail record matches one thesis definition."""

    if thesis.source and thesis.source not in detail.sources:
        return False
    if thesis.category and detail.category != thesis.category:
        return False
    if thesis.stage and detail.stage != thesis.stage:
        return False
    if thesis.confidence and confidence_bucket_for_value(detail.confidence) != thesis.confidence:
        return False
    if thesis.meta_trend and detail.meta_trend != thesis.meta_trend:
        return False
    if thesis.audience and not any(
        segment.segment_type == "audience" and segment.label == thesis.audience
        for segment in detail.audience_summary
    ):
        return False
    if thesis.market and not any(
        segment.segment_type == "market" and segment.label == thesis.market
        for segment in detail.audience_summary
    ):
        return False
    if thesis.language and not any(
        segment.segment_type == "language" and segment.label == thesis.language
        for segment in detail.audience_summary
    ):
        return False
    if thesis.geo_country and not any(geo.country_code == thesis.geo_country for geo in detail.geo_summary):
        return False
    if detail.score.total_score < thesis.minimum_score:
        return False
    if thesis.hide_recurring and detail.seasonality is not None and detail.seasonality.tag == "recurring":
        return False
    if thesis.keyword_query and thesis.keyword_query.strip():
        haystack = build_keyword_haystack(detail)
        if thesis.keyword_query.strip().lower() not in haystack:
            return False
    return True


def get_thesis_lens_score(detail: TrendDetailRecord, lens: str) -> float:
    """Return the lens score used to rank thesis matches."""

    if lens == "discovery":
        return detail.opportunity.discovery
    if lens == "seo":
        return detail.opportunity.seo
    if lens == "content":
        return detail.opportunity.content
    if lens == "product":
        return detail.opportunity.product
    if lens == "investment":
        return detail.opportunity.investment
    return detail.opportunity.composite


def confidence_bucket_for_value(confidence: float) -> str:
    """Return the same confidence buckets surfaced in the dashboard."""

    if confidence >= 0.75:
        return "high"
    if confidence >= 0.45:
        return "medium"
    return "low"


def build_keyword_haystack(detail: TrendDetailRecord) -> str:
    """Build a lowercase search corpus for thesis keyword matching."""

    parts = [
        detail.name,
        detail.summary,
        *detail.why_now,
        *detail.aliases,
        *(item.evidence for item in detail.evidence_items[:8]),
    ]
    return " ".join(part.lower() for part in parts if part)
