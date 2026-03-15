# Relevance-Based Snapshot Pruning

## Problem

Each pipeline run appends one row per ranked topic to `trend_score_snapshots`. At 1000 topics running every 15 minutes, that's ~96K rows/day — enough to exceed the Supabase free tier (500 MB) within 2 months.

Most of these rows belong to ephemeral topics (pop culture moments, breaking news) that disappear from the ranking within days. Their full-resolution history has no long-term value, while durable topics (AI agents, electric vehicles) need their history preserved for growth charts and forecasting.

## Solution

A pruning function that runs after each pipeline run, using `trend_entities.last_seen_at` to classify each topic's relevance and thin its snapshot history accordingly.

## Pruning Tiers

| State | Condition (`last_seen_at` age) | Snapshot Action | Metric Action |
|---|---|---|---|
| Active | < 7 days | Keep all | Keep all |
| Recently dormant | 7–30 days | Thin to 1 per calendar day | Keep all |
| Stale | 30–90 days | Thin to 1 per calendar week | Delete `trend_metric_snapshots` rows |
| Dead | 90+ days | Delete all snapshots | Delete `trend_metric_snapshots` rows |

### Thinning Logic

"Thin to 1 per day" means: for each topic in this tier, group its snapshot rows by the date portion of `trend_runs.captured_at`, keep the **published** row (`is_published = 1`) with the highest `run_id` in each date group (the latest published run of that day), and delete the rest. Unpublished rows for dormant/stale/dead topics are deleted unconditionally since they serve no consumer purpose in historical context.

"Thin to 1 per week" follows the same logic, grouping by ISO calendar week instead.

### Watchlist Protection

Topics that appear in any `watchlist_items` row are exempt from all pruning, regardless of `last_seen_at`. Users explicitly chose to track these.

### What Is NOT Pruned

- `trend_entities` — always kept (small rows, useful for "we've seen this before" detection)
- `trend_aliases` — kept alongside entities
- `signals` — already replaced each run (no growth)
- `trend_scores` — already replaced each run (no growth)
- `source_family_snapshots` — grows at ~20 rows/run regardless of topic count (1 per source family); at 72 runs/day that's ~1440 rows/day, well under 1 MB/month. Not worth pruning.

### Orphan Cleanup

After snapshot pruning, delete `trend_runs` rows that have zero remaining `trend_score_snapshots` referencing them. This keeps the runs table compact.

## Seasonality and Forecasting

### Accepted Degradation

Pruning snapshot rows affects two downstream consumers:

**Seasonality detection** (`get_topic_seasonality`): Uses `appearance_count` (total snapshot rows for a topic) and `get_topic_appearance_gaps` (consecutive run_id gaps) to classify topics as "recurring", "evergreen", etc. Thinning reduces `appearance_count` and inflates gap values. However, seasonality is only meaningful for active topics — a topic that hasn't appeared in 7+ days does not need an accurate seasonality tag. Dormant/stale seasonality results are not displayed to users since those topics are not in the live ranking.

**Forecasting** (`forecast_trend`): Requires `MIN_FORECAST_POINTS = 4` data points. After thinning to 1-per-day, a topic that was active for only 2-3 days loses its forecast. This is expected — forecasting a dormant topic is not useful.

Both degradations only affect topics that are no longer in the active ranking and therefore not visible to users on the explorer or detail pages.

## Data Model Notes

- `trend_score_snapshots.topic` stores the raw topic string (e.g., "ai agents")
- `trend_score_snapshots.is_published` distinguishes published (visible) from experimental rows
- `trend_entities.topic_key` stores the slugified version (e.g., "ai-agents")
- `watchlist_items.trend_id` also stores the slugified version
- The pruning function needs to slugify snapshot topics to look up entities and check watchlist protection. The `_slugify_topic` static method on `TrendScoreRepository` handles this.

## Integration Point

A new method `prune_stale_snapshots()` on `TrendScoreRepository` that accepts a `datetime` (now) and performs all pruning in a single transaction.

Called from `run_trend_pipeline()` in `app/jobs/compute_scores.py`, after notifications and before `connection.close()`.

The existing `concurrency: cancel-in-progress` setting on the GitHub Actions workflow prevents overlapping pipeline runs, so no lock contention is expected.

## SQL Strategy

The pruning runs as 5 SQL operations in one transaction:

1. **Identify protected topics:** Query `watchlist_items` for all trend_ids (slugs). Also query `trend_entities` to build a slug-to-topic mapping for non-active topics.

2. **Delete dead topic snapshots:** Delete from `trend_score_snapshots` where topic is in the dead set (last_seen > 90 days ago, not in watchlist).

3. **Thin dormant/stale topic snapshots:** For each tier, use a subquery to identify rows to keep (max `run_id` per date/week group per topic, filtered to `is_published = 1`), then delete all other rows for those topics.

4. **Clean up orphaned runs:** `DELETE FROM trend_runs WHERE id NOT IN (SELECT DISTINCT run_id FROM trend_score_snapshots)`.

5. **Delete stale/dead market metrics:** `DELETE FROM trend_metric_snapshots WHERE topic_key IN (...)` for topics in the stale or dead set.

## Observability

Log a summary after each prune: total rows deleted per tier (dead/stale/dormant), orphaned runs cleaned, metrics deleted. This validates the estimated impact and flags anomalies.

## Estimated Impact

At 1000 topics with ~60% ephemeral churn:
- Without pruning: ~2.9M snapshot rows/month
- With pruning: ~500K–800K rows/month (70–75% reduction)
- Supabase free tier comfortably sustainable for 6+ months

## Configuration

No new config needed initially. The tier thresholds (7/30/90 days) are constants in the pruning module. If they need to be tunable later, they can be added to `Settings`.

## Testing

- Unit test: verify thinning keeps 1 published row per day/week correctly
- Unit test: verify unpublished rows for non-active topics are deleted
- Unit test: verify watchlist-protected topics are never pruned
- Unit test: verify dead topics have all snapshots removed
- Unit test: verify orphaned trend_runs are cleaned up
- Unit test: verify active topics are untouched
- Unit test: verify stale/dead market metrics are deleted
- Unit test: verify logging output reports row counts per tier
