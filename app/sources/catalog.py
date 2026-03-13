"""Shared source metadata used by ingestion, extraction, and scoring."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SourceDefinition:
    """Stable metadata describing one source adapter."""

    name: str
    signal_type: str
    family: str
    reliability: float
    verticals: tuple[str, ...] = ()
    experimental: bool = False


SOURCE_DEFINITIONS: dict[str, SourceDefinition] = {
    "arxiv": SourceDefinition("arxiv", "knowledge", "research", 0.92, ("research", "science")),
    "chrome_web_store": SourceDefinition("chrome_web_store", "social", "launch", 0.71, ("consumer-tech", "productivity")),
    "curated_feeds": SourceDefinition(
        "curated_feeds",
        "knowledge",
        "news",
        0.73,
        ("world", "politics", "sports", "gaming", "culture", "tech"),
    ),
    "devto": SourceDefinition("devto", "social", "community", 0.7, ("tech", "developer")),
    "github": SourceDefinition("github", "developer", "developer", 0.9, ("tech", "developer")),
    "google_news": SourceDefinition(
        "google_news",
        "knowledge",
        "news",
        0.76,
        ("world", "politics", "sports", "culture", "business", "tech"),
    ),
    "google_trends": SourceDefinition("google_trends", "search", "search", 0.94, ("search", "general-interest")),
    "hacker_news": SourceDefinition("hacker_news", "social", "community", 0.82, ("tech", "startup")),
    "huggingface": SourceDefinition("huggingface", "developer", "research", 0.84, ("ai", "research", "developer")),
    "lobsters": SourceDefinition("lobsters", "social", "community", 0.74, ("tech", "developer")),
    "npm": SourceDefinition("npm", "developer", "developer", 0.86, ("tech", "developer")),
    "pypi": SourceDefinition("pypi", "developer", "developer", 0.82, ("tech", "developer")),
    "polymarket": SourceDefinition("polymarket", "search", "market", 0.58, ("politics", "markets"), experimental=True),
    "producthunt": SourceDefinition("producthunt", "social", "launch", 0.78, ("launches", "consumer-tech", "developer")),
    "reddit": SourceDefinition(
        "reddit",
        "social",
        "community",
        0.72,
        ("world", "politics", "sports", "gaming", "culture", "tech"),
    ),
    "stackoverflow": SourceDefinition("stackoverflow", "developer", "developer", 0.88, ("tech", "developer")),
    "twitter": SourceDefinition("twitter", "social", "social", 0.45, ("social", "general-interest"), experimental=True),
    "youtube": SourceDefinition("youtube", "social", "social", 0.79, ("gaming", "culture", "consumer-tech", "tech")),
    "wikipedia": SourceDefinition("wikipedia", "knowledge", "knowledge", 0.67, ("world", "culture", "science", "sports")),
}


def get_source_definition(source_name: str) -> SourceDefinition:
    """Return source metadata with a conservative default."""

    return SOURCE_DEFINITIONS.get(
        source_name,
        SourceDefinition(source_name, "social", "social", 0.5, experimental=True),
    )


def signal_type_for_source(source_name: str) -> str:
    """Return the normalized signal type for a source."""

    return get_source_definition(source_name).signal_type


def source_family_for_source(source_name: str) -> str:
    """Return the cross-source corroboration family for a source."""

    return get_source_definition(source_name).family


def source_reliability_for_source(source_name: str) -> float:
    """Return the reliability/confidence prior for a source."""

    return get_source_definition(source_name).reliability


def source_verticals_for_source(source_name: str) -> tuple[str, ...]:
    """Return the broad coverage verticals associated with a source."""

    return get_source_definition(source_name).verticals


def source_is_experimental(source_name: str) -> bool:
    """Return whether a source should be treated as non-critical."""

    return get_source_definition(source_name).experimental
