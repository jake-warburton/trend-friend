"""Topic extraction pipeline."""

from __future__ import annotations

from app.models import NormalizedSignal, RawSourceItem
from app.topics.normalize import (
    is_meaningful_topic,
    normalize_topic_name,
    remove_stop_words,
    tokenize_text,
)

MAX_TOPICS_PER_ITEM = 3
MAX_BIGRAMS_PER_ITEM = 2


def extract_candidate_topics(title: str) -> list[str]:
    """Extract unigram and bigram candidates from a title."""

    tokens = remove_stop_words(tokenize_text(title))
    if not tokens:
        return []
    candidates: list[str] = []
    canonical_topics = infer_canonical_topics(tokens)
    candidates.extend(canonical_topics)
    for first, second in zip(tokens, tokens[1:]):
        candidates.append(f"{first} {second}")
    if not candidates:
        candidates.extend(tokens[:3])
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


def infer_canonical_topics(tokens: list[str]) -> list[str]:
    """Add a few explicit topic heuristics for high-value recurring concepts."""

    inferred_topics: list[str] = []
    token_set = set(tokens)
    if "robotics" in token_set:
        inferred_topics.append("robotics")
    if "battery" in token_set and ("recycling" in token_set or "recovery" in token_set):
        inferred_topics.append("battery recycling")
    if ("ai" in token_set or "openai" in token_set or "artificial" in token_set) and (
        "agent" in token_set or "agents" in token_set
    ):
        inferred_topics.append("ai agents")
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
        "hacker_news": "social",
        "reddit": "social",
        "wikipedia": "knowledge",
    }.get(source_name, "social")
