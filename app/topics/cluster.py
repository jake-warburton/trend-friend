"""Topic clustering and aggregation."""

from __future__ import annotations

from collections import defaultdict

from app.models import NormalizedSignal, TopicAggregate
from app.topics.normalize import normalize_topic_name


def merge_similar_topics(signals: list[NormalizedSignal]) -> dict[str, list[NormalizedSignal]]:
    """Group signals under normalized topic names."""

    clusters: dict[str, list[NormalizedSignal]] = defaultdict(list)
    for signal in signals:
        clusters[normalize_topic_name(signal.topic)].append(signal)
    return dict(clusters)


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
            if signal.timestamp > latest_timestamp:
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
                evidence=evidence[:3],
            )
        )
    return aggregates
