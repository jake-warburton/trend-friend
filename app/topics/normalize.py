"""Topic normalization helpers."""

from __future__ import annotations

import re

STOP_WORDS = {
    "a",
    "an",
    "and",
    "apps",
    "are",
    "ask",
    "asks",
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
    "idea",
    "ideas",
    "if",
    "internal",
    "in",
    "into",
    "interview",
    "list",
    "lists",
    "milestone",
    "new",
    "office",
    "new",
    "of",
    "on",
    "operations",
    "or",
    "open",
    "process",
    "playlist",
    "repetitive",
    "replace",
    "replacing",
    "reshape",
    "software",
    "sdk",
    "source",
    "the",
    "their",
    "them",
    "this",
    "to",
    "tool",
    "tooling",
    "tools",
    "tutorial",
    "used",
    "using",
    "use",
    "momentum",
    "walk",
    "workflows",
    "with",
    "videos",
    "you",
    "your",
    "teams",
}

ALIASES = {
    "agent": "ai agents",
    "agents": "ai agents",
    "ai": "ai agents",
    "artificial intelligence": "ai agents",
    "llm": "large language models",
    "llms": "large language models",
    "large language model": "large language models",
    "rag": "retrieval augmented generation",
    "mcp": "model context protocol",
    "hf": "hugging face",
    "chatgpt": "chat gpt",
}
SHORT_MEANINGFUL_TOKENS = {"ai"}
NOISE_LEAD_TOKENS = {
    "best",
    "breaking",
    "launch",
    "show",
    "top",
    "why",
}
NOISE_TAIL_TOKENS = {
    "guide",
    "launch",
    "news",
    "podcast",
    "today",
    "update",
    "updates",
}
GENERIC_MULTIWORD_TOPICS = {
    "developer platform",
    "developer tools",
    "machine learning",
    "new model",
    "open source",
    "python package",
    "repeatable instructions",
    "video tutorial",
}
GENERIC_PHRASE_FRAGMENTS = {
    "alone journey",
    "capabilities repeatable",
    "feel really alone",
    "not promote",
    "really alone",
}


def clean_text(text: str) -> str:
    """Return lowercase ASCII-friendly text without punctuation noise."""

    lowered = text.lower()
    lowered = re.sub(r"\b([a-z0-9]+)['’]s\b", r"\1", lowered)
    lowered = re.sub(r"['’]", "", lowered)
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
    while deduplicated_tokens and deduplicated_tokens[0] in NOISE_LEAD_TOKENS:
        deduplicated_tokens.pop(0)
    while deduplicated_tokens and deduplicated_tokens[-1] in NOISE_TAIL_TOKENS:
        deduplicated_tokens.pop()
    normalized = " ".join(deduplicated_tokens)
    return ALIASES.get(normalized, normalized)


def is_meaningful_topic(topic_name: str) -> bool:
    """Return True when a topic candidate is specific enough to keep."""

    if not topic_name:
        return False
    tokens = topic_name.split()
    if len(tokens) == 1:
        return len(tokens[0]) >= 4 and tokens[0] not in STOP_WORDS
    if topic_name in GENERIC_MULTIWORD_TOPICS:
        return False
    if topic_name in GENERIC_PHRASE_FRAGMENTS:
        return False
    if tokens[0] in NOISE_LEAD_TOKENS or tokens[-1] in NOISE_TAIL_TOKENS:
        return False
    if all(token not in STOP_WORDS for token in tokens) is False:
        return False
    if all(len(token) <= 3 and token not in SHORT_MEANINGFUL_TOKENS for token in tokens):
        return False
    return True
