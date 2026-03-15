# Snapshot Pruning Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prune stale snapshot history to keep Supabase free tier sustainable at 1000 topics.

**Architecture:** A standalone `prune_stale_snapshots()` function in `app/data/pruning.py` (kept separate from the already-large `repositories.py`) runs after each pipeline run. It classifies topics by `trend_entities.last_seen_at` into active/dormant/stale/dead tiers, thins or deletes snapshot rows accordingly, and cleans up orphaned runs and stale market metrics. Watchlisted topics are exempt.

**Tech Stack:** Python, SQLite/PostgreSQL (dual-path via `app/data/primary.py`), unittest

**Spec:** `docs/superpowers/specs/2026-03-15-relevance-based-snapshot-pruning-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/data/pruning.py` | Create | All pruning logic: tier classification, thinning SQL, orphan cleanup, logging |
| `app/jobs/compute_scores.py` | Modify (line ~148) | Call `prune_stale_snapshots` after notifications |
| `tests/test_pruning.py` | Create | All pruning tests |

---

## Task 1: Core pruning module — dead topic deletion

**Files:**
- Create: `tests/test_pruning.py`
- Create: `app/data/pruning.py`

- [ ] **Step 1: Write failing test for dead topic snapshot deletion**

```python
"""Tests for relevance-based snapshot pruning."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.data.database import connect_database, initialize_database
from app.data.repositories import TrendScoreRepository, WatchlistRepository
from app.models import TrendScoreResult


def _make_score(topic: str, timestamp: datetime) -> TrendScoreResult:
    return TrendScoreResult(
        topic=topic,
        total_score=10.0,
        search_score=2.0,
        social_score=3.0,
        developer_score=2.0,
        knowledge_score=1.0,
        diversity_score=2.0,
        evidence=[topic],
        source_counts={"reddit": 1},
        latest_timestamp=timestamp,
        display_name=topic.title(),
    )


class PruningTests(unittest.TestCase):

    def setUp(self) -> None:
        self.database_path = Path("data/test_signal_eye_pruning.db")
        if self.database_path.exists():
            self.database_path.unlink()
        self.connection = connect_database(self.database_path)
        initialize_database(self.connection)
        self.repository = TrendScoreRepository(self.connection)

    def tearDown(self) -> None:
        self.connection.close()
        if self.database_path.exists():
            self.database_path.unlink()

    def test_dead_topic_snapshots_are_deleted(self) -> None:
        now = datetime(2026, 6, 15, tzinfo=timezone.utc)
        old_time = now - timedelta(days=100)
        score = _make_score("dead topic", old_time)
        self.repository.append_snapshot([score], captured_at=old_time)

        from app.data.pruning import prune_stale_snapshots
        result = prune_stale_snapshots(self.connection, now)

        history = self.repository.get_topic_history("dead topic", limit_runs=100)
        self.assertEqual(len(history), 0)
        self.assertGreater(result.dead_snapshots_deleted, 0)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_pruning.PruningTests.test_dead_topic_snapshots_are_deleted -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.data.pruning'`

- [ ] **Step 3: Write the pruning module with dead-topic deletion**

```python
"""Relevance-based snapshot pruning."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.data.connection import DatabaseConnection

LOGGER = logging.getLogger(__name__)

DORMANT_THRESHOLD_DAYS = 7
STALE_THRESHOLD_DAYS = 30
DEAD_THRESHOLD_DAYS = 90


@dataclass
class PruneResult:
    """Summary of a pruning operation."""
    dead_snapshots_deleted: int = 0
    dormant_snapshots_deleted: int = 0
    stale_snapshots_deleted: int = 0
    orphaned_runs_deleted: int = 0
    stale_metrics_deleted: int = 0


def prune_stale_snapshots(connection: DatabaseConnection, now: datetime) -> PruneResult:
    """Prune snapshot history based on topic relevance tiers."""

    result = PruneResult()

    protected_slugs = _get_watchlist_protected_slugs(connection)
    topic_tiers = _classify_topics(connection, now, protected_slugs)

    dead_topics = [topic for topic, tier in topic_tiers.items() if tier == "dead"]
    if dead_topics:
        result.dead_snapshots_deleted = _delete_snapshots_for_topics(connection, dead_topics)

    result.orphaned_runs_deleted = _delete_orphaned_runs(connection)

    connection.commit()

    LOGGER.info(
        "Pruning complete: dead=%d dormant=%d stale=%d orphan_runs=%d metrics=%d",
        result.dead_snapshots_deleted,
        result.dormant_snapshots_deleted,
        result.stale_snapshots_deleted,
        result.orphaned_runs_deleted,
        result.stale_metrics_deleted,
    )
    return result


def _get_watchlist_protected_slugs(connection: DatabaseConnection) -> set[str]:
    """Return all trend_id slugs that appear in any watchlist."""
    rows = connection.execute("SELECT DISTINCT trend_id FROM watchlist_items").fetchall()
    return {row["trend_id"] for row in rows}


def _slugify(topic: str) -> str:
    """Match TrendScoreRepository._slugify_topic."""
    normalized = "".join(c.lower() if c.isalnum() else "-" for c in topic)
    compact = "-".join(part for part in normalized.split("-") if part)
    return compact or "trend"


def _classify_topics(
    connection: DatabaseConnection,
    now: datetime,
    protected_slugs: set[str],
) -> dict[str, str]:
    """Classify each topic in trend_entities into a pruning tier."""

    rows = connection.execute(
        "SELECT topic_key, last_seen_at FROM trend_entities"
    ).fetchall()

    tiers: dict[str, str] = {}
    for row in rows:
        slug = row["topic_key"]
        if slug in protected_slugs:
            continue
        last_seen = datetime.fromisoformat(row["last_seen_at"])
        age_days = (now - last_seen).total_seconds() / 86400
        if age_days < DORMANT_THRESHOLD_DAYS:
            continue  # active — skip
        elif age_days < STALE_THRESHOLD_DAYS:
            tiers[slug] = "dormant"
        elif age_days < DEAD_THRESHOLD_DAYS:
            tiers[slug] = "stale"
        else:
            tiers[slug] = "dead"
    return tiers


def _get_raw_topics_for_slugs(connection: DatabaseConnection, slugs: list[str]) -> list[str]:
    """Find raw topic strings in trend_score_snapshots that match the given slugs."""

    if not slugs:
        return []
    all_topics_rows = connection.execute(
        "SELECT DISTINCT topic FROM trend_score_snapshots"
    ).fetchall()
    slug_set = set(slugs)
    return [row["topic"] for row in all_topics_rows if _slugify(row["topic"]) in slug_set]


def _delete_snapshots_for_topics(connection: DatabaseConnection, slugs: list[str]) -> int:
    """Delete all snapshot rows for the given topic slugs."""

    raw_topics = _get_raw_topics_for_slugs(connection, slugs)
    if not raw_topics:
        return 0
    placeholders = ",".join("?" for _ in raw_topics)
    cursor = connection.execute(
        f"DELETE FROM trend_score_snapshots WHERE topic IN ({placeholders})",
        raw_topics,
    )
    return cursor.rowcount


def _delete_orphaned_runs(connection: DatabaseConnection) -> int:
    """Delete trend_runs with no remaining snapshots."""

    cursor = connection.execute(
        "DELETE FROM trend_runs WHERE id NOT IN (SELECT DISTINCT run_id FROM trend_score_snapshots)"
    )
    return cursor.rowcount
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests.test_pruning.PruningTests.test_dead_topic_snapshots_are_deleted -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/data/pruning.py tests/test_pruning.py
git commit -m "feat: add pruning module with dead topic deletion"
```

---

## Task 2: Active and watchlist-protected topics are never pruned

**Files:**
- Modify: `tests/test_pruning.py`

- [ ] **Step 1: Write failing tests**

Add to `PruningTests`:

```python
def test_active_topic_snapshots_are_untouched(self) -> None:
    now = datetime(2026, 6, 15, tzinfo=timezone.utc)
    recent_time = now - timedelta(days=2)
    score = _make_score("active topic", recent_time)
    self.repository.append_snapshot([score], captured_at=recent_time)

    from app.data.pruning import prune_stale_snapshots
    prune_stale_snapshots(self.connection, now)

    history = self.repository.get_topic_history("active topic", limit_runs=100)
    self.assertEqual(len(history), 1)

def test_watchlisted_dead_topic_is_protected(self) -> None:
    now = datetime(2026, 6, 15, tzinfo=timezone.utc)
    old_time = now - timedelta(days=100)
    score = _make_score("watchlisted topic", old_time)
    self.repository.append_snapshot([score], captured_at=old_time)

    watchlist_repo = WatchlistRepository(self.connection)
    watchlist_id = watchlist_repo.create_watchlist("Test Watchlist")
    watchlist_repo.add_watchlist_item(watchlist_id, "watchlisted-topic", "Watchlisted Topic")

    from app.data.pruning import prune_stale_snapshots
    prune_stale_snapshots(self.connection, now)

    history = self.repository.get_topic_history("watchlisted topic", limit_runs=100)
    self.assertEqual(len(history), 1)
```

- [ ] **Step 2: Run tests to verify they pass** (these should pass already with current implementation)

Run: `python3 -m unittest tests.test_pruning -v`
Expected: All 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_pruning.py
git commit -m "test: verify active and watchlisted topics survive pruning"
```

---

## Task 3: Dormant topic thinning (1 per day)

**Files:**
- Modify: `tests/test_pruning.py`
- Modify: `app/data/pruning.py`

- [ ] **Step 1: Write failing test**

Add to `PruningTests`:

```python
def test_dormant_topic_thinned_to_one_per_day(self) -> None:
    now = datetime(2026, 6, 15, tzinfo=timezone.utc)
    dormant_day = now - timedelta(days=10)

    # Simulate 4 runs on the same day (every 15 min)
    scores = []
    for i in range(4):
        t = dormant_day + timedelta(minutes=15 * i)
        scores.append((_make_score("dormant topic", t), t))

    for score, captured_at in scores:
        self.repository.append_snapshot([score], captured_at=captured_at)

    from app.data.pruning import prune_stale_snapshots
    result = prune_stale_snapshots(self.connection, now)

    history = self.repository.get_topic_history("dormant topic", limit_runs=100)
    self.assertEqual(len(history), 1)  # Only 1 kept per day
    self.assertGreater(result.dormant_snapshots_deleted, 0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest tests.test_pruning.PruningTests.test_dormant_topic_thinned_to_one_per_day -v`
Expected: FAIL — dormant thinning not yet implemented

- [ ] **Step 3: Implement dormant thinning**

Add to `app/data/pruning.py` in `prune_stale_snapshots`, after dead deletion:

```python
    dormant_topics = [topic for topic, tier in topic_tiers.items() if tier == "dormant"]
    if dormant_topics:
        result.dormant_snapshots_deleted = _thin_snapshots_by_date(connection, dormant_topics)
```

Add the function:

```python
def _thin_snapshots_by_date(connection: DatabaseConnection, slugs: list[str]) -> int:
    """Keep only the latest published snapshot per calendar day for each topic."""

    raw_topics = _get_raw_topics_for_slugs(connection, slugs)
    if not raw_topics:
        return 0
    placeholders = ",".join("?" for _ in raw_topics)

    # Find IDs to keep: max run_id per (topic, date) where is_published = 1
    keep_ids_rows = connection.execute(
        f"""
        SELECT MAX(s.id) AS keep_id
        FROM trend_score_snapshots s
        INNER JOIN trend_runs r ON r.id = s.run_id
        WHERE s.topic IN ({placeholders})
          AND s.is_published = 1
        GROUP BY s.topic, DATE(r.captured_at)
        """,
        raw_topics,
    ).fetchall()
    keep_ids = {row["keep_id"] for row in keep_ids_rows}

    if not keep_ids:
        # No published rows — delete everything for these topics
        cursor = connection.execute(
            f"DELETE FROM trend_score_snapshots WHERE topic IN ({placeholders})",
            raw_topics,
        )
        return cursor.rowcount

    keep_placeholders = ",".join("?" for _ in keep_ids)
    cursor = connection.execute(
        f"""
        DELETE FROM trend_score_snapshots
        WHERE topic IN ({placeholders})
          AND id NOT IN ({keep_placeholders})
        """,
        raw_topics + list(keep_ids),
    )
    return cursor.rowcount
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m unittest tests.test_pruning -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/data/pruning.py tests/test_pruning.py
git commit -m "feat: add dormant topic thinning (1 per calendar day)"
```

---

## Task 4: Stale topic thinning (1 per week) + metric deletion

**Files:**
- Modify: `tests/test_pruning.py`
- Modify: `app/data/pruning.py`

- [ ] **Step 1: Write failing tests**

Add to `PruningTests`:

```python
def test_stale_topic_thinned_to_one_per_week(self) -> None:
    now = datetime(2026, 6, 15, tzinfo=timezone.utc)

    # Create snapshots across 2 weeks, 3 per week, 45 days ago
    scores = []
    for day_offset in range(14):
        t = now - timedelta(days=45 + day_offset)
        scores.append((_make_score("stale topic", t), t))

    for score, captured_at in scores:
        self.repository.append_snapshot([score], captured_at=captured_at)

    from app.data.pruning import prune_stale_snapshots
    result = prune_stale_snapshots(self.connection, now)

    history = self.repository.get_topic_history("stale topic", limit_runs=100)
    self.assertLessEqual(len(history), 2)  # At most 1 per week across 2 weeks
    self.assertGreater(result.stale_snapshots_deleted, 0)

def test_stale_topic_market_metrics_are_deleted(self) -> None:
    now = datetime(2026, 6, 15, tzinfo=timezone.utc)
    old_time = now - timedelta(days=45)
    score = _make_score("stale metric topic", old_time)
    self.repository.append_snapshot([score], captured_at=old_time)

    from app.models import TrendMetricSnapshot
    self.repository.upsert_topic_market_footprint("stale metric topic", [
        TrendMetricSnapshot(
            source="test", metric_key="test_key", label="Test",
            value_numeric=100.0, value_display="100", unit="count",
            period="monthly", captured_at=old_time, confidence=0.9,
        ),
    ])

    from app.data.pruning import prune_stale_snapshots
    result = prune_stale_snapshots(self.connection, now)

    metrics = self.repository.get_topic_market_footprint("stale metric topic")
    self.assertEqual(len(metrics), 0)
    self.assertGreater(result.stale_metrics_deleted, 0)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m unittest tests.test_pruning -v`
Expected: 2 new tests FAIL

- [ ] **Step 3: Implement stale thinning and metric deletion**

Add to `prune_stale_snapshots` in `app/data/pruning.py`, after dormant thinning:

```python
    stale_topics = [topic for topic, tier in topic_tiers.items() if tier == "stale"]
    if stale_topics:
        result.stale_snapshots_deleted = _thin_snapshots_by_week(connection, stale_topics)

    # Delete market metrics for stale + dead topics
    metric_delete_slugs = stale_topics + dead_topics
    if metric_delete_slugs:
        result.stale_metrics_deleted = _delete_market_metrics(connection, metric_delete_slugs)
```

Add the functions:

```python
def _thin_snapshots_by_week(connection: DatabaseConnection, slugs: list[str]) -> int:
    """Keep only the latest published snapshot per ISO calendar week for each topic."""

    raw_topics = _get_raw_topics_for_slugs(connection, slugs)
    if not raw_topics:
        return 0
    placeholders = ",".join("?" for _ in raw_topics)

    keep_ids_rows = connection.execute(
        f"""
        SELECT MAX(s.id) AS keep_id
        FROM trend_score_snapshots s
        INNER JOIN trend_runs r ON r.id = s.run_id
        WHERE s.topic IN ({placeholders})
          AND s.is_published = 1
        GROUP BY s.topic, STRFTIME('%Y-%W', r.captured_at)
        """,
        raw_topics,
    ).fetchall()
    keep_ids = {row["keep_id"] for row in keep_ids_rows}

    if not keep_ids:
        cursor = connection.execute(
            f"DELETE FROM trend_score_snapshots WHERE topic IN ({placeholders})",
            raw_topics,
        )
        return cursor.rowcount

    keep_placeholders = ",".join("?" for _ in keep_ids)
    cursor = connection.execute(
        f"""
        DELETE FROM trend_score_snapshots
        WHERE topic IN ({placeholders})
          AND id NOT IN ({keep_placeholders})
        """,
        raw_topics + list(keep_ids),
    )
    return cursor.rowcount


def _delete_market_metrics(connection: DatabaseConnection, slugs: list[str]) -> int:
    """Delete trend_metric_snapshots for the given topic slugs."""

    if not slugs:
        return 0
    placeholders = ",".join("?" for _ in slugs)
    cursor = connection.execute(
        f"DELETE FROM trend_metric_snapshots WHERE topic_key IN ({placeholders})",
        slugs,
    )
    return cursor.rowcount
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -m unittest tests.test_pruning -v`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/data/pruning.py tests/test_pruning.py
git commit -m "feat: add stale thinning (1 per week) and metric deletion"
```

---

## Task 5: Orphan run cleanup + logging verification

**Files:**
- Modify: `tests/test_pruning.py`

- [ ] **Step 1: Write test for orphan cleanup**

Add to `PruningTests`:

```python
def test_orphaned_runs_are_cleaned_up(self) -> None:
    now = datetime(2026, 6, 15, tzinfo=timezone.utc)
    old_time = now - timedelta(days=100)
    score = _make_score("orphan test", old_time)
    self.repository.append_snapshot([score], captured_at=old_time)

    run_count_before = self.connection.execute("SELECT COUNT(*) AS c FROM trend_runs").fetchone()["c"]
    self.assertGreater(run_count_before, 0)

    from app.data.pruning import prune_stale_snapshots
    result = prune_stale_snapshots(self.connection, now)

    run_count_after = self.connection.execute("SELECT COUNT(*) AS c FROM trend_runs").fetchone()["c"]
    self.assertEqual(run_count_after, 0)
    self.assertGreater(result.orphaned_runs_deleted, 0)

def test_prune_result_reports_counts(self) -> None:
    now = datetime(2026, 6, 15, tzinfo=timezone.utc)

    # Mix of tiers
    dead_time = now - timedelta(days=100)
    dormant_time = now - timedelta(days=10)
    active_time = now - timedelta(days=1)

    self.repository.append_snapshot([_make_score("dead one", dead_time)], captured_at=dead_time)
    for i in range(3):
        t = dormant_time + timedelta(minutes=15 * i)
        self.repository.append_snapshot([_make_score("dormant one", t)], captured_at=t)
    self.repository.append_snapshot([_make_score("active one", active_time)], captured_at=active_time)

    from app.data.pruning import prune_stale_snapshots
    result = prune_stale_snapshots(self.connection, now)

    self.assertGreater(result.dead_snapshots_deleted, 0)
    self.assertGreater(result.dormant_snapshots_deleted, 0)
    self.assertGreater(result.orphaned_runs_deleted, 0)
```

- [ ] **Step 2: Run tests**

Run: `python3 -m unittest tests.test_pruning -v`
Expected: All 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_pruning.py
git commit -m "test: verify orphan cleanup and result reporting"
```

---

## Task 6: Pipeline integration

**Files:**
- Modify: `app/jobs/compute_scores.py` (line ~148)

- [ ] **Step 1: Add pruning call to the pipeline**

In `app/jobs/compute_scores.py`, add after the `deliver_post_run_notifications` block and before `connection.close()`:

```python
    from app.data.pruning import prune_stale_snapshots
    prune_stale_snapshots(connection, captured_at)
```

The full context (add between notifications and `connection.close()`):

```python
    deliver_post_run_notifications(
        connection=connection,
        run_at=captured_at,
        alert_events=alert_events,
        digest=digest,
    )

    from app.data.pruning import prune_stale_snapshots
    prune_stale_snapshots(connection, captured_at)

    connection.close()
    return ranked_scores
```

- [ ] **Step 2: Run the full test suite to verify nothing breaks**

Run: `python3 -m unittest discover -s tests -p "*.py" -v 2>&1 | tail -5`
Expected: All tests PASS (335+ tests)

- [ ] **Step 3: Commit**

```bash
git add app/jobs/compute_scores.py
git commit -m "feat: run snapshot pruning after each pipeline run"
```

---

## Task 7: Full integration test

**Files:**
- Modify: `tests/test_pruning.py`

- [ ] **Step 1: Write end-to-end integration test**

Add to `PruningTests`:

```python
def test_full_pruning_lifecycle(self) -> None:
    """Simulate a realistic mix of topics over time and verify pruning behavior."""

    now = datetime(2026, 6, 15, 12, 0, tzinfo=timezone.utc)

    # Active topic: appeared 2 hours ago — untouched
    active_time = now - timedelta(hours=2)
    self.repository.append_snapshot([_make_score("ai agents", active_time)], captured_at=active_time)

    # Dormant topic: 8 runs across 2 days, 15 days ago — thinned to 2
    for day in range(2):
        for run in range(4):
            t = now - timedelta(days=15) + timedelta(days=day, minutes=15 * run)
            self.repository.append_snapshot([_make_score("super bowl", t)], captured_at=t)

    # Dead topic: 1 run 120 days ago — deleted
    dead_time = now - timedelta(days=120)
    self.repository.append_snapshot([_make_score("old meme", dead_time)], captured_at=dead_time)

    from app.data.pruning import prune_stale_snapshots
    result = prune_stale_snapshots(self.connection, now)

    # Active: all preserved
    self.assertEqual(len(self.repository.get_topic_history("ai agents", limit_runs=100)), 1)

    # Dormant: thinned to 1 per day = 2
    dormant_history = self.repository.get_topic_history("super bowl", limit_runs=100)
    self.assertEqual(len(dormant_history), 2)

    # Dead: all gone
    self.assertEqual(len(self.repository.get_topic_history("old meme", limit_runs=100)), 0)

    # Verify counts are nonzero
    self.assertGreater(result.dead_snapshots_deleted, 0)
    self.assertGreater(result.dormant_snapshots_deleted, 0)
```

- [ ] **Step 2: Run full test suite**

Run: `python3 -m unittest discover -s tests -p "*.py" -v 2>&1 | tail -5`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_pruning.py
git commit -m "test: add full pruning lifecycle integration test"
```
