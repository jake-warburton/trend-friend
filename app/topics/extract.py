"""Topic extraction pipeline."""

from __future__ import annotations

import re

from app.models import NormalizedSignal, RawSourceItem
from app.topics.normalize import (
    is_meaningful_topic,
    normalize_topic_name,
    remove_stop_words,
    tokenize_text,
)

MAX_TOPICS_PER_ITEM = 3
MAX_BIGRAMS_PER_ITEM = 2
LOW_SIGNAL_BIGRAM_TOKENS = {
    "all",
    "adopted",
    "away",
    "based",
    "becomes",
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
    "rules",
    "shuts",
    "show",
    "same",
    "started",
    "supports",
    "successful",
    "take",
    "that",
    "t20",
    "two",
    "use",
    "user",
    "was",
    "walking",
    "years",
    "your",
}


def extract_candidate_topics(title: str) -> list[str]:
    """Extract unigram and bigram candidates from a title."""

    tokens = remove_stop_words(tokenize_text(title))
    if not tokens:
        return []
    candidates: list[str] = []
    canonical_topics = infer_canonical_topics(tokens)
    repository_topic = infer_repository_topic(title)
    if repository_topic:
        candidates.append(repository_topic)
    candidates.extend(canonical_topics)
    if not repository_topic:
        candidates.extend(infer_meaningful_bigrams(tokens))
    if not candidates:
        candidates.extend(infer_meaningful_unigrams(tokens))
    seen: set[str] = set()
    ordered_candidates: list[str] = []
    added_bigrams = 0
    for candidate in candidates:
        normalized = normalize_topic_name(candidate)
        if normalized and is_meaningful_topic(normalized) and normalized not in seen:
            is_non_canonical_bigram = " " in normalized and normalized not in canonical_topics
            if is_non_canonical_bigram and added_bigrams >= MAX_BIGRAMS_PER_ITEM:
                continue
            seen.add(normalized)
            ordered_candidates.append(normalized)
            if is_non_canonical_bigram:
                added_bigrams += 1
            if len(ordered_candidates) >= MAX_TOPICS_PER_ITEM:
                break
    return ordered_candidates


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

    bigrams: list[str] = []
    for first, second in zip(tokens, tokens[1:]):
        if first == second:
            continue
        if token_contains_number(first) or token_contains_number(second):
            continue
        if second == "ai":
            continue
        if first in LOW_SIGNAL_BIGRAM_TOKENS or second in LOW_SIGNAL_BIGRAM_TOKENS:
            continue
        bigram = f"{first} {second}"
        if is_meaningful_topic(normalize_topic_name(bigram)):
            bigrams.append(bigram)
    return bigrams


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
    return inferred_topics


def build_signals_from_items(items: list[RawSourceItem]) -> list[NormalizedSignal]:
    """Convert raw source items into topic-level normalized signals."""

    signals: list[NormalizedSignal] = []
    for item in items:
        for topic in extract_candidate_topics(item.title):
            signals.append(
                NormalizedSignal(
                    topic=topic,
                    source=item.source,
                    signal_type=signal_type_for_source(item.source),
                    value=item.engagement_score,
                    timestamp=item.timestamp,
                    evidence=item.title,
                )
            )
    return signals


def signal_type_for_source(source_name: str) -> str:
    """Map a source name to a stable signal type."""

    return {
        "github": "developer",
        "google_trends": "search",
        "hacker_news": "social",
        "reddit": "social",
        "wikipedia": "knowledge",
    }.get(source_name, "social")
