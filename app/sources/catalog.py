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
    experimental: bool = False


SOURCE_DEFINITIONS: dict[str, SourceDefinition] = {
    "arxiv": SourceDefinition("arxiv", "knowledge", "research", 0.92),
    "devto": SourceDefinition("devto", "social", "community", 0.7),
    "github": SourceDefinition("github", "developer", "developer", 0.9),
    "google_news": SourceDefinition("google_news", "knowledge", "news", 0.76),
    "google_trends": SourceDefinition("google_trends", "search", "search", 0.94),
    "hacker_news": SourceDefinition("hacker_news", "social", "community", 0.82),
    "huggingface": SourceDefinition("huggingface", "developer", "research", 0.84),
    "lobsters": SourceDefinition("lobsters", "social", "community", 0.74),
    "npm": SourceDefinition("npm", "developer", "developer", 0.86),
    "pypi": SourceDefinition("pypi", "developer", "developer", 0.82),
    "polymarket": SourceDefinition("polymarket", "search", "market", 0.58, experimental=True),
    "producthunt": SourceDefinition("producthunt", "social", "launch", 0.78),
    "reddit": SourceDefinition("reddit", "social", "community", 0.72),
    "stackoverflow": SourceDefinition("stackoverflow", "developer", "developer", 0.88),
    "twitter": SourceDefinition("twitter", "social", "social", 0.45, experimental=True),
    "youtube": SourceDefinition("youtube", "social", "social", 0.79),
    "wikipedia": SourceDefinition("wikipedia", "knowledge", "knowledge", 0.67),
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


def source_is_experimental(source_name: str) -> bool:
    """Return whether a source should be treated as non-critical."""

    return get_source_definition(source_name).experimental
