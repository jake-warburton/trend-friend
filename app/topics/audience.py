"""Heuristic audience and market enrichment for collected source items."""

from __future__ import annotations

from dataclasses import dataclass

from app.models import RawSourceItem
from app.topics.geo import GeoAssignment

_AUDIENCE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "developer": ("developer", "developers", "github", "sdk", "api", "framework", "open source", "opensource"),
    "founder": ("startup", "startups", "founder", "founders", "venture", "yc", "pitch"),
    "research": ("research", "paper", "study", "benchmark", "arxiv", "scientist"),
    "enterprise": ("enterprise", "b2b", "compliance", "procurement", "it team"),
    "consumer": ("consumer", "shopping", "creator", "gaming", "lifestyle", "app store"),
}

_MARKET_KEYWORDS: dict[str, tuple[str, ...]] = {
    "b2b": ("enterprise", "b2b", "sales", "procurement", "platform"),
    "b2c": ("consumer", "creator", "shopping", "app", "gaming", "social"),
    "global": ("global", "worldwide", "international"),
    "us-market": ("us", "usa", "united states"),
    "europe-market": ("europe", "eu", "united kingdom", "uk", "germany", "france"),
}

_SOURCE_AUDIENCE_FLAGS: dict[str, tuple[str, ...]] = {
    "github": ("developer",),
    "hacker_news": ("developer", "founder"),
    "reddit": (),
    "google_trends": ("consumer",),
    "wikipedia": ("research",),
    "twitter": ("consumer", "founder"),
}

_LANGUAGE_KEYS = ("lang", "language_code", "content_language")
_ENGLISH_MARKERS = (" the ", " and ", " for ", " with ", " new ", " startup ", " developers ")


@dataclass(frozen=True)
class AudienceAssignment:
    """Derived audience and market metadata attached to a post or signal."""

    audience_flags: tuple[str, ...] = ()
    market_flags: tuple[str, ...] = ()
    language_code: str | None = None


def assign_audience_flags(item: RawSourceItem, geo: GeoAssignment) -> AudienceAssignment:
    """Return conservative audience and market metadata for a source item."""

    text = f" {item.title.lower()} {' '.join(item.metadata.values()).lower()} "
    audience_flags = set(_SOURCE_AUDIENCE_FLAGS.get(item.source, ()))
    for flag, keywords in _AUDIENCE_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            audience_flags.add(flag)

    market_flags: set[str] = set()
    for flag, keywords in _MARKET_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            market_flags.add(flag)

    if geo.country_code == "US":
        market_flags.add("us-market")
    elif geo.country_code in {"GB", "DE", "FR", "IE"} or (geo.region and "Europe" in geo.region):
        market_flags.add("europe-market")
    elif geo.country_code and geo.country_code not in {"US", "GB", "DE", "FR", "IE"}:
        market_flags.add("global")

    if "enterprise" in audience_flags or item.source == "github":
        market_flags.add("b2b")
    if "consumer" in audience_flags or item.source == "google_trends":
        market_flags.add("b2c")

    language_code = _detect_language_code(item, text)
    return AudienceAssignment(
        audience_flags=tuple(sorted(audience_flags)),
        market_flags=tuple(sorted(market_flags)),
        language_code=language_code,
    )


def _detect_language_code(item: RawSourceItem, text: str) -> str | None:
    for key in _LANGUAGE_KEYS:
        value = item.metadata.get(key, "").strip().lower()
        if value in {"en", "english"}:
            return "en"
        if len(value) == 2 and value.isalpha():
            return value
    if all(ord(character) < 128 for character in item.title) and any(marker in text for marker in _ENGLISH_MARKERS):
        return "en"
    return None
