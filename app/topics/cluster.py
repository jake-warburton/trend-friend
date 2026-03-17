"""Topic clustering and aggregation."""

from __future__ import annotations

from collections import defaultdict

from app.models import NormalizedSignal, TopicAggregate
from app.topics.display import build_display_name
from app.topics.normalize import normalize_topic_name


def merge_similar_topics(signals: list[NormalizedSignal]) -> dict[str, list[NormalizedSignal]]:
    """Group signals under normalized topic names."""

    clusters: dict[str, list[NormalizedSignal]] = defaultdict(list)
    for signal in signals:
        clusters[normalize_topic_name(signal.topic)].append(signal)
    return merge_related_evidence_topics(dict(clusters))


def merge_related_evidence_topics(
    clusters: dict[str, list[NormalizedSignal]],
) -> dict[str, list[NormalizedSignal]]:
    """Collapse same-headline variants when topics substantially overlap."""

    merged_clusters: dict[str, list[NormalizedSignal]] = {}
    for topic_name, topic_signals in clusters.items():
        matching_topic = find_matching_cluster_topic(topic_name, topic_signals, merged_clusters)
        if matching_topic is None:
            merged_clusters[topic_name] = list(topic_signals)
            continue
        merged_clusters[matching_topic].extend(topic_signals)
    return merged_clusters


def find_matching_cluster_topic(
    topic_name: str,
    topic_signals: list[NormalizedSignal],
    merged_clusters: dict[str, list[NormalizedSignal]],
) -> str | None:
    """Return an existing cluster name when the topic is a likely duplicate variant."""

    topic_tokens = set(topic_name.split())
    topic_evidence = {signal.evidence for signal in topic_signals}
    for existing_topic, existing_signals in merged_clusters.items():
        existing_tokens = set(existing_topic.split())
        shared_tokens = topic_tokens & existing_tokens
        if not shared_tokens:
            continue
        existing_evidence = {signal.evidence for signal in existing_signals}
        if topic_evidence & existing_evidence:
            return existing_topic
        if topics_likely_match(topic_name, existing_topic, topic_tokens, existing_tokens):
            return existing_topic
    return None


def topics_likely_match(
    topic_name: str,
    existing_topic: str,
    topic_tokens: set[str],
    existing_tokens: set[str],
) -> bool:
    """Return True when two topic labels are close enough to be clustered together."""

    if topic_name == existing_topic:
        return True
    if topic_tokens <= existing_tokens or existing_tokens <= topic_tokens:
        return True
    smaller = min(len(topic_tokens), len(existing_tokens))
    if smaller == 0:
        return False
    overlap_ratio = len(topic_tokens & existing_tokens) / smaller
    return overlap_ratio >= 0.75


def aggregate_topic_signals(signals: list[NormalizedSignal]) -> list[TopicAggregate]:
    """Aggregate clusters into inspectable topic summaries."""

    aggregates: list[TopicAggregate] = []
    for topic_name, topic_signals in merge_similar_topics(signals).items():
        source_counts: dict[str, int] = defaultdict(int)
        signal_counts: dict[str, int] = defaultdict(int)
        total_signal_value = 0.0
        latest_timestamp = topic_signals[0].timestamp
        evidence: list[str] = []
        for signal in topic_signals:
            source_counts[signal.source] += 1
            signal_counts[signal.signal_type] += 1
            total_signal_value += signal.value
            try:
                if signal.timestamp > latest_timestamp:
                    latest_timestamp = signal.timestamp
            except TypeError:
                # Mixed naive/aware datetimes — normalize both to naive UTC
                a = signal.timestamp.replace(tzinfo=None) if signal.timestamp.tzinfo else signal.timestamp
                b = latest_timestamp.replace(tzinfo=None) if latest_timestamp.tzinfo else latest_timestamp
                if a > b:
                    latest_timestamp = signal.timestamp
            if signal.evidence not in evidence:
                evidence.append(signal.evidence)
        aggregates.append(
            TopicAggregate(
                topic=topic_name,
                source_counts=dict(source_counts),
                signal_counts=dict(signal_counts),
                total_signal_value=total_signal_value,
                average_signal_value=total_signal_value / len(topic_signals),
                latest_timestamp=latest_timestamp,
                evidence=evidence[:5],
                display_name=build_display_name(topic_name, [signal.evidence for signal in topic_signals]),
            )
        )
    return aggregates
