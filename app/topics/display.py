"""Helpers for preserving human-readable topic display names."""

from __future__ import annotations

import re

from app.topics.normalize import clean_text

TOKEN_PATTERN = re.compile(r"[A-Za-z0-9]+")


def build_display_name(topic: str, evidence_items: list[str]) -> str:
    """Return a readable display name, preferring source-preserved casing."""

    display_name = derive_display_name(topic, evidence_items)
    if display_name is None:
        return fallback_display_name(topic)
    if display_name == display_name.lower():
        return fallback_display_name(topic)
    return normalize_display_name_phrase(display_name)


def derive_display_name(topic: str, evidence_items: list[str]) -> str | None:
    """Return the first exact evidence phrase that matches the normalized topic."""

    topic_tokens = clean_text(topic).split()
    if not topic_tokens:
        return None
    for evidence in evidence_items:
        phrase = extract_topic_phrase(evidence, topic_tokens)
        if phrase is not None:
            return phrase
    return None


def extract_topic_phrase(text: str, topic_tokens: list[str]) -> str | None:
    """Extract the original-cased token phrase for one normalized topic."""

    original_tokens = TOKEN_PATTERN.findall(text)
    normalized_tokens = [token.lower() for token in original_tokens]
    token_count = len(topic_tokens)
    if token_count == 0 or token_count > len(normalized_tokens):
        return None
    for index in range(len(normalized_tokens) - token_count + 1):
        if normalized_tokens[index : index + token_count] == topic_tokens:
            return " ".join(original_tokens[index : index + token_count])
    return None


def fallback_display_name(topic: str) -> str:
    """Return a simple readable fallback when evidence has no exact phrase match."""

    formatted_parts: list[str] = []
    for part in topic.split():
        if len(part) <= 3 and part.isalpha():
            formatted_parts.append(part.upper())
            continue
        formatted_parts.append(part.capitalize())
    return " ".join(formatted_parts)


def normalize_display_name_phrase(phrase: str) -> str:
    """Normalize a preserved phrase into display-case without losing signal casing."""

    normalized_parts: list[str] = []
    for part in phrase.split():
        if not part:
            continue
        if part.isupper() or any(character.isupper() for character in part[1:]) or any(
            character.isdigit() for character in part
        ):
            normalized_parts.append(part)
            continue
        if part.islower():
            normalized_parts.append(part.capitalize())
            continue
        normalized_parts.append(part)
    return " ".join(normalized_parts)
