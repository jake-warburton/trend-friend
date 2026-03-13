# Source Expansion Notes

## Short Audit

- `app/jobs/ingest.py` is the right orchestration seam for adding sources. It already isolates adapter failures per source.
- `app/sources/base.py` is the right place for shared retry, caching, and graceful-degradation behavior.
- `app/topics/extract.py`, `app/topics/normalize.py`, and `app/topics/cluster.py` are the right seams for improving trend quality without rewriting the ranking pipeline.
- `app/scoring/calculator.py` is the right place to evolve the score as long as it stays transparent and deterministic.

## What This Expansion Added

- New free-source adapters:
  - `Curated Feeds`
  - `DEV Community`
  - `Hugging Face`
  - `npm`
  - `PyPI`
  - `YouTube`
  - `Chrome Web Store`
  - `Lobsters`
- Shared source metadata in `app/sources/catalog.py`:
  - signal type
  - source family
  - reliability prior
  - experimental status
- Experimental gating:
  - Twitter/X is now explicitly controlled by `SIGNAL_EYE_ENABLE_TWITTER_SOURCE`
  - experimental sources can be disabled globally with `SIGNAL_EYE_ENABLE_EXPERIMENTAL_SOURCES`
- Source request hardening:
  - retry count
  - small in-process TTL cache
- Topic-quality improvements:
  - metadata-driven topic hints from tags/keywords
  - broader alias normalization for `LLM`, `RAG`, `MCP`, `ChatGPT`
  - stronger stop-phrase suppression
  - subset/overlap cluster merging
- Scoring improvements:
  - freshness bonus
  - velocity bonus
  - source reliability adjustment
  - cross-family corroboration bonus
  - stronger generic-topic penalties
- Source analytics improvements:
  - persisted `source_family_snapshots`
  - family-level pulse history for ranked, corroborated, and top-ranked trend contribution

## Tradeoffs

- The new sources were chosen for stability and free access, not perfect volume coverage.
- Hugging Face, npm, and PyPI are highly useful for builder trends, but they skew technical by design.
- YouTube improves social velocity coverage materially, but its live path depends on an API key and quota discipline.
- Curated feeds improve editorial corroboration and source density, but they are still headline-heavy and therefore intentionally capped in topic fan-out.
- Chrome Web Store adds distribution and utility signals, but it currently exposes ratings and listing relevance more cleanly than install counts, so scoring stays conservative.
- DEV Community and Lobsters help with early social/builder corroboration, but their volumes are much smaller than Reddit.
- Twitter/X remains optional because unauthenticated or unstable access should not become a critical dependency.

## Broader News Expansion

- `google_news` now samples `WORLD`, `NATION`, `BUSINESS`, `TECHNOLOGY`, `SCIENCE`, `HEALTH`, `SPORTS`, and `ENTERTAINMENT`.
- `curated_feeds` is no longer only AI-builder oriented; it now mixes BBC world/politics/entertainment coverage with the existing tech feeds plus a gaming feed.
- `reddit` now spans broader community/news subreddits across politics, world news, sports, gaming, movies, television, and pop culture in addition to the existing tech-builder communities.
- Topic extraction now has explicit support for:
  - named news entities
  - issue phrases like `iran war`
  - sports competitions and teams
  - gaming and entertainment titles
- Topic normalization now suppresses more headline scaffolding such as `live updates`, `watch live`, `fans react`, and `what to know`.
- Scoring now gives more weight to:
  - mixed signal types
  - broad-interest corroboration
  - non-tech topics confirmed across search, news, and social
- Scoring now penalizes topics that only echo within the same developer/community ecosystem.

## Recommended Next Sources

- Chrome Web Store or browser-extension rankings
- App Store / Google Play public rankings if a stable free path is acceptable
- curated RSS bundles for niche sectors
