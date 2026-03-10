"""Topic normalization helpers."""

from __future__ import annotations

import re

STOP_WORDS = {
    "a",
    "an",
    "and",
    "apps",
    "are",
    "before",
    "building",
    "by",
    "coding",
    "companies",
    "company",
    "developers",
    "developer",
    "gain",
    "for",
    "from",
    "gains",
    "how",
    "internal",
    "in",
    "into",
    "list",
    "milestone",
    "new",
    "office",
    "new",
    "of",
    "on",
    "operations",
    "or",
    "open",
    "repetitive",
    "replace",
    "replacing",
    "reshape",
    "software",
    "sdk",
    "source",
    "startup",
    "startups",
    "the",
    "their",
    "to",
    "tool",
    "tooling",
    "tools",
    "used",
    "using",
    "momentum",
    "workflows",
    "with",
}

ALIASES = {
    "agent": "ai agents",
    "agents": "ai agents",
    "ai": "ai agents",
    "artificial intelligence": "ai agents",
}
SHORT_MEANINGFUL_TOKENS = {"ai"}


def clean_text(text: str) -> str:
    """Return lowercase ASCII-friendly text without punctuation noise."""

    lowered = text.lower()
    cleaned = re.sub(r"[^a-z0-9\s/-]", " ", lowered)
    return re.sub(r"\s+", " ", cleaned).strip()


def tokenize_text(text: str) -> list[str]:
    """Split cleaned text into tokens."""

    return [token for token in clean_text(text).replace("/", " ").replace("-", " ").split() if token]


def remove_stop_words(tokens: list[str]) -> list[str]:
    """Filter out low-value stop words."""

    return [
        token
        for token in tokens
        if token not in STOP_WORDS and (len(token) > 2 or token in SHORT_MEANINGFUL_TOKENS)
    ]


def normalize_topic_name(topic_name: str) -> str:
    """Normalize a topic candidate into a stable comparable name."""

    normalized = clean_text(topic_name)
    normalized = normalized.replace("github", "").strip()
    tokens = [token for token in normalized.split() if token]
    deduplicated_tokens: list[str] = []
    for token in tokens:
        if token not in deduplicated_tokens:
            deduplicated_tokens.append(token)
    normalized = " ".join(deduplicated_tokens)
    return ALIASES.get(normalized, normalized)


def is_meaningful_topic(topic_name: str) -> bool:
    """Return True when a topic candidate is specific enough to keep."""

    if not topic_name:
        return False
    tokens = topic_name.split()
    if len(tokens) == 1:
        return len(tokens[0]) >= 4 and tokens[0] not in STOP_WORDS
    return all(token not in STOP_WORDS for token in tokens)
