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

"Thin to 1 per day" means: for each topic in this tier, group its snapshot rows by the date portion of `trend_runs.captured_at`, keep the row with the highest `run_id` in each date group (the latest run of that day), and delete the rest.

"Thin to 1 per week" follows the same logic, grouping by ISO calendar week instead.

### Watchlist Protection

Topics that appear in any `watchlist_items` row are exempt from all pruning, regardless of `last_seen_at`. Users explicitly chose to track these.

### What Is NOT Pruned

- `trend_entities` — always kept (small rows, useful for "we've seen this before" detection)
- `trend_aliases` — kept alongside entities
- `signals` — already replaced each run (no growth)
- `trend_scores` — already replaced each run (no growth)

### Orphan Cleanup

After snapshot pruning, delete `trend_runs` rows that have zero remaining `trend_score_snapshots` referencing them. This keeps the runs table compact.

## Data Model Notes

- `trend_score_snapshots.topic` stores the raw topic string (e.g., "ai agents")
- `trend_entities.topic_key` stores the slugified version (e.g., "ai-agents")
- `watchlist_items.trend_id` also stores the slugified version
- The pruning function needs to slugify snapshot topics to look up entities and check watchlist protection. The `_slugify_topic` static method on `TrendScoreRepository` handles this.

## Integration Point

A new method `prune_stale_snapshots()` on `TrendScoreRepository` that accepts a `datetime` (now) and performs all pruning in a single transaction.

Called from `run_trend_pipeline()` in `app/jobs/compute_scores.py`, after notifications and before `connection.close()`.

## SQL Strategy

The pruning runs as 4 SQL operations in one transaction:

1. **Identify protected topics:** Query `watchlist_items` for all trend_ids (slugs). Also query `trend_entities` to build a slug-to-topic mapping for non-active topics.

2. **Delete dead topic snapshots:** Delete from `trend_score_snapshots` where topic is in the dead set (last_seen > 90 days ago, not in watchlist).

3. **Thin dormant/stale topic snapshots:** For each tier, use a subquery to identify rows to keep (max run_id per date/week group per topic), then delete all other rows for those topics.

4. **Clean up orphaned runs:** `DELETE FROM trend_runs WHERE id NOT IN (SELECT DISTINCT run_id FROM trend_score_snapshots)`.

5. **Delete stale/dead market metrics:** `DELETE FROM trend_metric_snapshots WHERE topic_key IN (...)` for topics in the stale or dead set.

## Estimated Impact

At 1000 topics with ~60% ephemeral churn:
- Without pruning: ~2.9M snapshot rows/month
- With pruning: ~500K–800K rows/month (70–75% reduction)
- Supabase free tier comfortably sustainable for 6+ months

## Configuration

No new config needed initially. The tier thresholds (7/30/90 days) are constants in the pruning module. If they need to be tunable later, they can be added to `Settings`.

## Testing

- Unit test: verify thinning logic keeps 1 per day/week correctly
- Unit test: verify watchlist-protected topics are never pruned
- Unit test: verify dead topics have all snapshots removed
- Unit test: verify orphaned trend_runs are cleaned up
- Unit test: verify active topics are untouched
