"""Topic extraction pipeline."""

from __future__ import annotations

import re
from math import log10

from app.models import NormalizedSignal, RawSourceItem
from app.topics.audience import assign_audience_flags
from app.topics.geo import assign_geo_flags
from app.topics.normalize import (
    is_meaningful_topic,
    normalize_topic_name,
    remove_stop_words,
    tokenize_text,
)

MAX_TOPICS_PER_ITEM = 3
MAX_BIGRAMS_PER_ITEM = 2
SOURCE_TOPIC_LIMITS = {
    "google_trends": 2,
    "hacker_news": 2,
    "polymarket": 2,
    "twitter": 2,
}
SOURCE_BIGRAM_LIMITS = {
    "google_trends": 1,
    "hacker_news": 1,
    "polymarket": 1,
    "twitter": 1,
}
SOURCE_LOW_SIGNAL_TOKENS = {
    "hacker_news": {"watching", "people", "report", "reports", "footage"},
    "twitter": {"watching", "people", "report", "reports", "footage"},
}
BIGRAM_HEAD_TOKENS = {
    "analytics",
    "automation",
    "battery",
    "center",
    "cloud",
    "copilot",
    "database",
    "filesystem",
    "framework",
    "guitar",
    "inference",
    "infrastructure",
    "lisp",
    "market",
    "model",
    "models",
    "monitoring",
    "network",
    "origin",
    "page",
    "payments",
    "pipeline",
    "plant",
    "platform",
    "pricing",
    "recycling",
    "robotics",
    "sales",
    "sensors",
    "software",
    "stack",
    "storage",
    "strategy",
    "supply",
    "systems",
    "tuner",
    "view",
    "vision",
    "words",
    "workflow",
    "workflows",
}
BIGRAM_MODIFIER_TOKENS = {
    "agent",
    "agents",
    "ai",
    "audio",
    "battery",
    "climate",
    "common",
    "copyleft",
    "data",
    "developer",
    "distributed",
    "electric",
    "embedded",
    "enterprise",
    "filesystem",
    "guitar",
    "open",
    "posthog",
    "pricing",
    "quantum",
    "robot",
    "robotics",
    "sales",
    "saas",
    "street",
    "supply",
    "vector",
    "vercel",
    "video",
    "warehouse",
}
LOW_SIGNAL_BIGRAM_TOKENS = {
    "all",
    "adopted",
    "away",
    "based",
    "becomes",
    "build",
    "can",
    "cost",
    "cross",
    "doesn",
    "each",
    "everything",
    "extend",
    "extends",
    "film",
    "find",
    "getting",
    "graphing",
    "has",
    "hn",
    "here",
    "if",
    "immediately",
    "interview",
    "its",
    "last",
    "legal",
    "legitimate",
    "launch",
    "list",
    "matters",
    "men",
    "most",
    "need",
    "now",
    "opinionated",
    "others",
    "per",
    "process",
    "promote",
    "rules",
    "shuts",
    "show",
    "same",
    "started",
    "supports",
    "successful",
    "take",
    "that",
    "them",
    "t20",
    "two",
    "use",
    "user",
    "was",
    "walk",
    "walking",
    "will",
    "years",
    "you",
    "your",
}


def extract_candidate_topics(title: str, source_name: str | None = None) -> list[str]:
    """Extract unigram and bigram candidates from a title."""

    tokens = remove_stop_words(tokenize_text(title))
    if source_name:
        blocked_tokens = SOURCE_LOW_SIGNAL_TOKENS.get(source_name, set())
        tokens = [token for token in tokens if token not in blocked_tokens]
    if not tokens:
        return []
    candidates: list[str] = []
    source_specific_topics = infer_source_specific_topics(tokens, source_name)
    candidates.extend(source_specific_topics)
    canonical_topics = infer_canonical_topics(tokens)
    repository_topic = infer_repository_topic(title)
    if repository_topic:
        candidates.append(repository_topic)
    candidates.extend(canonical_topics)
    if not repository_topic and not source_specific_topics:
        candidates.extend(infer_meaningful_bigrams(tokens))
    if not candidates and source_name not in {"google_trends", "hacker_news", "polymarket", "twitter"}:
        candidates.extend(infer_meaningful_unigrams(tokens))
    seen: set[str] = set()
    ordered_candidates: list[str] = []
    added_bigrams = 0
    max_topics = SOURCE_TOPIC_LIMITS.get(source_name or "", MAX_TOPICS_PER_ITEM)
    max_bigrams = SOURCE_BIGRAM_LIMITS.get(source_name or "", MAX_BIGRAMS_PER_ITEM)
    for candidate in candidates:
        normalized = normalize_topic_name(candidate)
        if normalized and is_meaningful_topic(normalized) and normalized not in seen:
            is_non_canonical_bigram = " " in normalized and normalized not in canonical_topics
            if is_non_canonical_bigram and added_bigrams >= max_bigrams:
                continue
            seen.add(normalized)
            ordered_candidates.append(normalized)
            if is_non_canonical_bigram:
                added_bigrams += 1
            if len(ordered_candidates) >= max_topics:
                break
    return ordered_candidates


def infer_source_specific_topics(tokens: list[str], source_name: str | None) -> list[str]:
    """Return source-specific canonical topics before general extraction heuristics."""

    if source_name == "polymarket":
        return infer_polymarket_topics(tokens)
    return []


def infer_repository_topic(title: str) -> str | None:
    """Extract a stable topic from a leading owner/repository identifier."""

    repository_match = re.match(r"^\s*([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)\b", title)
    if repository_match is None:
        return None
    owner_name, repository_name = repository_match.group(1).split("/", maxsplit=1)
    repository_tokens = tokenize_text(repository_name)
    if not repository_tokens:
        return None
    topic = " ".join(repository_tokens)
    return normalize_topic_name(topic) if topic else None


def infer_meaningful_bigrams(tokens: list[str]) -> list[str]:
    """Return a small set of higher-signal bigrams from an ordered token list."""

    scored_bigrams: list[tuple[float, int, str]] = []
    for index, (first, second) in enumerate(zip(tokens, tokens[1:])):
        if first == second:
            continue
        if token_contains_number(first) or token_contains_number(second):
            continue
        if second == "ai":
            continue
        if first in LOW_SIGNAL_BIGRAM_TOKENS or second in LOW_SIGNAL_BIGRAM_TOKENS:
            continue
        bigram = f"{first} {second}"
        normalized = normalize_topic_name(bigram)
        if is_meaningful_topic(normalized):
            scored_bigrams.append((score_bigram_candidate(first, second, index), index, bigram))
    scored_bigrams.sort(key=lambda item: (-item[0], item[1]))
    return [bigram for _, _, bigram in scored_bigrams]


def infer_meaningful_unigrams(tokens: list[str]) -> list[str]:
    """Return fallback single-token topics after removing weak tokens."""

    return [
        token
        for token in tokens
        if token not in LOW_SIGNAL_BIGRAM_TOKENS and not token_contains_number(token)
    ][:MAX_TOPICS_PER_ITEM]


def token_contains_number(token: str) -> bool:
    """Return True for numeric or year-like tokens that make weak topic fragments."""

    return any(character.isdigit() for character in token)


def score_bigram_candidate(first: str, second: str, index: int) -> float:
    """Prefer noun-like domain phrases over generic adjacent token pairs."""

    score = 0.0
    if second in BIGRAM_HEAD_TOKENS:
        score += 4.0
    if first in BIGRAM_MODIFIER_TOKENS:
        score += 2.5
    if len(second) >= 7:
        score += 0.75
    if len(first) >= 6:
        score += 0.35
    # Slightly prefer later surviving phrases over headline framing near the start.
    score += min(index, 5) * 0.15
    return score


def infer_canonical_topics(tokens: list[str]) -> list[str]:
    """Add a few explicit topic heuristics for high-value recurring concepts."""

    inferred_topics: list[str] = []
    token_set = set(tokens)
    if "robotics" in token_set:
        inferred_topics.append("robotics")
    if "battery" in token_set and ("recycling" in token_set or "recovery" in token_set):
        inferred_topics.append("battery recycling")
    if "certificate" in token_set and "origin" in token_set:
        inferred_topics.append("certificate origin")
    if "common" in token_set and "lisp" in token_set:
        inferred_topics.append("common lisp")
    if "english" in token_set and "words" in token_set:
        inferred_topics.append("english words")
    if "street" in token_set and "view" in token_set:
        inferred_topics.append("street view")
    if "world" in token_set and "cup" in token_set:
        inferred_topics.append("world cup")
    if ("ai" in token_set or "openai" in token_set or "artificial" in token_set) and (
        "agent" in token_set or "agents" in token_set
    ):
        inferred_topics.append("ai agents")
    if "copyleft" in token_set and "erosion" in token_set:
        inferred_topics.append("copyleft erosion")
    if "stargate" in token_set and "data" in token_set:
        inferred_topics.append("stargate data")
    if {"model", "context", "protocol"} <= token_set:
        inferred_topics.append("model context protocol")
    if {"battery", "energy", "storage"} <= token_set:
        inferred_topics.append("battery energy storage")
    if {"retrieval", "augmented", "generation"} <= token_set:
        inferred_topics.append("retrieval augmented generation")
    if {"large", "language", "models"} <= token_set:
        inferred_topics.append("large language models")
    return inferred_topics


def infer_polymarket_topics(tokens: list[str]) -> list[str]:
    """Collapse threshold-style Polymarket titles into stable asset/company topics."""

    token_set = set(tokens)
    if "bitcoin" in token_set or "btc" in token_set:
        return ["bitcoin"]
    if "ethereum" in token_set or "eth" in token_set:
        return ["ethereum"]
    if {"crude", "oil"} <= token_set or "oil" in token_set:
        return ["crude oil"]
    if "fed" in token_set:
        return ["federal reserve"]
    if "openai" in token_set or "gpt" in token_set:
        return ["openai"]
    if "solana" in token_set or "sol" in token_set:
        return ["solana"]
    return []


def build_signals_from_items(items: list[RawSourceItem]) -> list[NormalizedSignal]:
    """Convert raw source items into topic-level normalized signals."""

    signals: list[NormalizedSignal] = []
    for item in items:
        geo = assign_geo_flags(item)
        audience = assign_audience_flags(item, geo)
        for topic in extract_candidate_topics(item.title, source_name=item.source):
            signals.append(
                NormalizedSignal(
                    topic=topic,
                    source=item.source,
                    signal_type=signal_type_for_source(item.source),
                    value=signal_value_for_item(item),
                    timestamp=item.timestamp,
                    evidence=item.title,
                    evidence_url=item.url,
                    language_code=audience.language_code,
                    audience_flags=audience.audience_flags,
                    market_flags=audience.market_flags,
                    geo_flags=geo.flags,
                    geo_country_code=geo.country_code,
                    geo_region=geo.region,
                    geo_detection_mode=geo.detection_mode,
                    geo_confidence=geo.confidence,
                )
            )
    return signals


def signal_value_for_item(item: RawSourceItem) -> float:
    """Return a source-aware signal value without changing signal type semantics."""

    if item.source != "polymarket":
        return item.engagement_score
    return polymarket_signal_value(item)


def polymarket_signal_value(item: RawSourceItem) -> float:
    """Compress market size into a distinct, conviction-aware Polymarket signal."""

    volume_24hr = _metadata_float(item.metadata, "volume24hr", item.engagement_score)
    liquidity = _metadata_float(item.metadata, "liquidity", 0.0)
    open_interest = _metadata_float(item.metadata, "open_interest", 0.0)
    market_activity = max(volume_24hr + (liquidity * 0.15), 0.0)
    market_depth = max(open_interest, 0.0)
    normalized_value = (log10(market_activity + 1.0) * 9.0) + (log10(market_depth + 1.0) * 4.0)

    if volume_24hr >= 100_000 or open_interest >= 250_000:
        normalized_value *= 1.2
    elif volume_24hr < 5_000 and open_interest < 25_000:
        normalized_value *= 0.45

    return round(normalized_value, 2)


def signal_type_for_source(source_name: str) -> str:
    """Map a source name to a stable signal type."""

    return {
        "arxiv": "knowledge",
        "github": "developer",
        "google_trends": "search",
        "producthunt": "social",
        "stackoverflow": "developer",
        "hacker_news": "social",
        "polymarket": "search",
        "reddit": "social",
        "twitter": "social",
        "wikipedia": "knowledge",
    }.get(source_name, "social")


def _metadata_float(metadata: dict[str, str], key: str, default: float = 0.0) -> float:
    """Read a numeric metadata value safely."""

    try:
        return float(metadata.get(key, default))
    except (TypeError, ValueError):
        return default
