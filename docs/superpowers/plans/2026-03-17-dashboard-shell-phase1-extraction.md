# Dashboard Shell Phase 1: Extract Constants, Types & Utilities

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract ~1100 lines of constants, types, formatting utilities, filter logic, share helpers, community builders, source palette, and the BreakingFeedSection component out of `dashboard-shell.tsx` into focused modules under `web/components/explorer/`.

**Architecture:** Pure extraction — no logic changes, no new features. Each new file gets the exact code that's currently inline in `dashboard-shell.tsx`, and `dashboard-shell.tsx` switches to importing from the new files. Existing external consumers (`tests/dashboard-community-spotlights.test.ts`) update their import paths.

**Tech Stack:** TypeScript, React (for BreakingFeedSection and thesis preset icons)

---

## File Structure

| New File | Responsibility | ~Lines |
|----------|---------------|--------|
| `web/components/explorer/types.ts` | `ThesisPreset`, `ExplorerActiveFilter`, `ThesisPresetFilterState` | ~40 |
| `web/components/explorer/constants.ts` | All filter option arrays, default options, sort directions, empty sentinels, polling intervals, `WATCHLISTS_ENABLED` | ~130 |
| `web/components/explorer/thesis-presets.tsx` | `THESIS_PRESETS` array + `THESIS_PRESET_ICONS` map | ~85 |
| `web/components/explorer/format.ts` | ~40 pure formatting/display functions | ~450 |
| `web/components/explorer/filters.ts` | `listActiveExplorerFilters`, `isThesisPresetApplied`, `shouldClearActiveThesisPreset`, `buildSegmentFilterOptions`, `build*FilterOptions` | ~175 |
| `web/components/explorer/shares.ts` | All share expiry/history/formatting helpers | ~100 |
| `web/components/explorer/community.ts` | `buildCommunitySpotlights`, export href builders | ~80 |
| `web/components/explorer/source-palette.ts` | `SOURCE_PALETTE`, `getSourceColor`, `buildConicGradient` | ~25 |
| `web/components/explorer/breaking-feed-section.tsx` | `BreakingFeedSection` component | ~115 |

**Modified Files:**

| File | Change |
|------|--------|
| `web/components/dashboard-shell.tsx` | Remove extracted code, add imports from `explorer/*` |
| `web/tests/dashboard-community-spotlights.test.ts` | Update import paths |

---

### Task 1: Create `explorer/types.ts`

**Files:**
- Create: `web/components/explorer/types.ts`

- [ ] **Step 1: Create the types file**

```ts
export type ThesisPreset = {
  key: string;
  label: string;
  description: string;
  lens?: string;
  source?: string;
  stage?: string;
  audience?: string;
  hideRecurring?: boolean;
  minimumScore?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  status?: string;
};

export type ExplorerActiveFilter = {
  key:
    | "keyword"
    | "source"
    | "category"
    | "stage"
    | "confidence"
    | "lens"
    | "metaTrend"
    | "audience"
    | "market"
    | "language"
    | "geo"
    | "sort"
    | "status"
    | "seasonality";
  label: string;
  value: string;
};

export type ThesisPresetFilterState = {
  keyword: string;
  selectedSource: string;
  selectedCategory: string;
  selectedStage: string;
  selectedConfidence: string;
  selectedLens: string;
  selectedMetaTrend: string;
  selectedAudience: string;
  selectedMarket: string;
  selectedLanguage: string;
  selectedGeoCountry: string;
  minimumScore: number | null;
  sortBy: string;
  sortDirection: "asc" | "desc";
  selectedStatus: string;
  hideRecurring: boolean;
};
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd web && npx tsc --noEmit components/explorer/types.ts`

- [ ] **Step 3: Commit**

```bash
git add web/components/explorer/types.ts
git commit -m "refactor: extract explorer types from dashboard-shell"
```

---

### Task 2: Create `explorer/constants.ts`

**Files:**
- Create: `web/components/explorer/constants.ts`

- [ ] **Step 1: Create the constants file**

Move from `dashboard-shell.tsx` lines 106–224 and line 226 into this file. All constants are plain objects/arrays with no component dependencies.

Contents: `OVERVIEW_POLL_INTERVAL_MS`, `UPDATED_TRENDS_FLASH_MS`, `EMPTY_GENERATED_AT`, `EMPTY_HISTORY`, `EMPTY_DETAIL_INDEX`, `EMPTY_SOURCE_SUMMARY`, `SOURCE_FILTER_OPTIONS`, `DEFAULT_CATEGORY_OPTION`, `DEFAULT_AUDIENCE_OPTION`, `DEFAULT_MARKET_OPTION`, `DEFAULT_LANGUAGE_OPTION`, `DEFAULT_STAGE_OPTION`, `DEFAULT_CONFIDENCE_OPTION`, `DEFAULT_META_TREND_OPTION`, `STAGE_OPTIONS`, `CONFIDENCE_OPTIONS`, `LENS_OPTIONS`, `SORT_OPTIONS`, `DEFAULT_SORT_DIRECTIONS`, `DEFAULT_STATUS_OPTION`, `STATUS_OPTIONS`, `WATCHLISTS_ENABLED`, `EXPLORER_PAGE_SIZE` (currently declared inside the component at line 447 — extract here as a module-level constant).

Import types from `@/lib/types` as needed (for `TrendHistoryResponse`, `TrendDetailIndexResponse`, `SourceSummaryResponse`).

- [ ] **Step 2: Verify the file compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/explorer/constants.ts
git commit -m "refactor: extract explorer constants from dashboard-shell"
```

---

### Task 3: Create `explorer/thesis-presets.tsx`

**Files:**
- Create: `web/components/explorer/thesis-presets.tsx`

- [ ] **Step 1: Create the file**

Move `THESIS_PRESET_ICONS` (lines 243–275) and `THESIS_PRESETS` (lines 277–325) from `dashboard-shell.tsx`. Import `ThesisPreset` from `./types`. This file needs `.tsx` extension because `THESIS_PRESET_ICONS` contains JSX (inline SVGs). Import React at top.

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/explorer/thesis-presets.tsx
git commit -m "refactor: extract thesis presets and icons from dashboard-shell"
```

---

### Task 4: Create `explorer/source-palette.ts`

**Files:**
- Create: `web/components/explorer/source-palette.ts`

- [ ] **Step 1: Create the file**

Move `SOURCE_PALETTE` (lines 4204–4210), `getSourceColor` (lines 4212–4214), and `buildConicGradient` (lines 4328–4343) from `dashboard-shell.tsx`.

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/explorer/source-palette.ts
git commit -m "refactor: extract source palette from dashboard-shell"
```

---

### Task 5: Create `explorer/format.ts`

**Files:**
- Create: `web/components/explorer/format.ts`

- [ ] **Step 1: Create the file**

Move all pure formatting functions from `dashboard-shell.tsx` lines 3277–3646, 3946–4098, and 4198–4202. These are:

`formatTimestamp`, `buildTrendCardKey`, `formatCompactTimestamp`, `formatDateOnly`, `buildShareActivityMap`, `formatRankChange`, `formatMomentum`, `formatMomentumHeadline`, `formatMomentumDetail`, `formatScoreMix`, `formatCollapsedSourceDriverSummary`, `formatCollapsedCorroborationSummary`, `movementClassName`, `compareDates`, `formatSourceStatus`, `formatCategory`, `sourceHealthClassName`, `contributionHealthClassName`, `formatWatchSeverity`, `formatDuration`, `formatShareTokenLabel`, `formatShareActivityTimestamp`, `formatTrendStatus`, `trendStatusClassName`, `formatVolatility`, `volatilityClassName`, `scaleValue`, `formatPercent`, `formatAlertRuleType`, `formatSourceContributionSummary`, `formatAudienceSummary`, `formatAudiencePrefix`, `formatAudienceLabel`, `formatConfidenceLabel`, `formatConfidenceBucketLabel`, `formatStageLabel`, `buildTrendAudienceBadge`, `summarizeTrendAudience`, `formatLanguageLabel`, `formatExplorerSortLabel`, `formatStatusLabel`, `getOpportunityScoreForLens`, `formatLensLabel`, `summarizeThesisFilters`, `getOptionLabel`, `formatGeoCountryLabel`, `isDataStale`.

These depend on imports from `@/lib/types`, `@/lib/category-labels`, `@/lib/source-health`, `@/lib/geo-map-data`, `@/lib/trend-filters`. Add those imports.

Export all functions.

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/explorer/format.ts
git commit -m "refactor: extract explorer formatting utilities from dashboard-shell"
```

---

### Task 6: Create `explorer/filters.ts`

**Files:**
- Create: `web/components/explorer/filters.ts`

- [ ] **Step 1: Create the file**

Move from `dashboard-shell.tsx`:
- `listActiveExplorerFilters` (lines 3764–3885) — exported
- `isThesisPresetApplied` (lines 3887–3912) — exported
- `shouldClearActiveThesisPreset` (lines 3914–3919) — exported
- `buildSegmentFilterOptions` (lines 3921–3941) — internal helper
- `buildAudienceFilterOptions` (lines 3731–3737) — exported
- `buildMarketFilterOptions` (lines 3739–3741) — exported
- `buildLanguageFilterOptions` (lines 3743–3759) — exported

Import types from `./types` (`ThesisPreset`, `ExplorerActiveFilter`, `ThesisPresetFilterState`).
Import constants from `./constants` (`DEFAULT_SORT_DIRECTIONS`, `DEFAULT_AUDIENCE_OPTION`, `DEFAULT_MARKET_OPTION`, `DEFAULT_LANGUAGE_OPTION`).
Import `formatSourceLabel` from `@/lib/source-health` (it is NOT in `./format`).
Import formatting functions from `./format` (`formatCategory`, `formatStageLabel`, `formatConfidenceBucketLabel`, `formatLensLabel`, `formatAudienceLabel`, `formatLanguageLabel`, `formatExplorerSortLabel`, `formatStatusLabel`, `formatGeoCountryLabel`).

Also re-export the backwards-compatibility re-exports that currently live in dashboard-shell:
```ts
export { trendMatchesAudience, trendMatchesMarket, trendMatchesLanguage } from "@/lib/trend-filters";
export { confidenceBucketForTrend } from "@/lib/trend-filters";
```

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/explorer/filters.ts
git commit -m "refactor: extract explorer filter logic from dashboard-shell"
```

---

### Task 7: Create `explorer/shares.ts`

**Files:**
- Create: `web/components/explorer/shares.ts`

- [ ] **Step 1: Create the file**

Move from `dashboard-shell.tsx` lines 4100–4196:
`buildShareExpiryIso`, `defaultShareExpiryPreset`, `resolveShareExpiryIso`, `resolveDefaultShareExpiryDays`, `sharePresetToDays`, `formatShareDurationLabel`, `formatWatchlistDefaultShareExpiry`, `formatShareDefaultOptionLabel`, `fillShareHistory`, `formatShareExpirySummary`.

Import `formatCompactTimestamp` from `./format` (used by `formatShareExpirySummary`).
Import `Watchlist` type from `@/lib/types`.

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/explorer/shares.ts
git commit -m "refactor: extract share helpers from dashboard-shell"
```

---

### Task 8: Create `explorer/community.ts`

**Files:**
- Create: `web/components/explorer/community.ts`

- [ ] **Step 1: Create the file**

Move from `dashboard-shell.tsx`:
- `buildCommunitySpotlights` (lines 3648–3721) — exported
- `buildCommunityExportHref` (lines 3723–3725) — exported
- `buildSharedWatchlistExportHref` (lines 3727–3729) — exported

Import `PublicWatchlistSummary` from `@/lib/types`.

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/explorer/community.ts
git commit -m "refactor: extract community spotlights from dashboard-shell"
```

---

### Task 9: Create `explorer/breaking-feed-section.tsx`

**Files:**
- Create: `web/components/explorer/breaking-feed-section.tsx`

- [ ] **Step 1: Create the file**

Move `BreakingFeedSection` (lines 4216–4326) from `dashboard-shell.tsx`. Add `"use client"` directive at top. Import `useState` from React and `BreakingFeed` type from `@/lib/types`. Export the component.

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/explorer/breaking-feed-section.tsx
git commit -m "refactor: extract BreakingFeedSection from dashboard-shell"
```

---

### Task 10: Update `dashboard-shell.tsx` — replace inline code with imports

**Files:**
- Modify: `web/components/dashboard-shell.tsx`

- [ ] **Step 1: Add imports from new explorer modules**

At the top of `dashboard-shell.tsx`, after existing imports, add:

```ts
import type { ThesisPreset, ExplorerActiveFilter, ThesisPresetFilterState } from "@/components/explorer/types";
import {
  OVERVIEW_POLL_INTERVAL_MS,
  UPDATED_TRENDS_FLASH_MS,
  EMPTY_GENERATED_AT,
  EMPTY_HISTORY,
  EMPTY_DETAIL_INDEX,
  EMPTY_SOURCE_SUMMARY,
  SOURCE_FILTER_OPTIONS,
  DEFAULT_CATEGORY_OPTION,
  DEFAULT_AUDIENCE_OPTION,
  DEFAULT_MARKET_OPTION,
  DEFAULT_LANGUAGE_OPTION,
  DEFAULT_STAGE_OPTION,
  DEFAULT_CONFIDENCE_OPTION,
  DEFAULT_META_TREND_OPTION,
  STAGE_OPTIONS,
  CONFIDENCE_OPTIONS,
  LENS_OPTIONS,
  SORT_OPTIONS,
  DEFAULT_SORT_DIRECTIONS,
  DEFAULT_STATUS_OPTION,
  STATUS_OPTIONS,
  WATCHLISTS_ENABLED,
  EXPLORER_PAGE_SIZE,
} from "@/components/explorer/constants";
import { THESIS_PRESETS, THESIS_PRESET_ICONS } from "@/components/explorer/thesis-presets";
import { SOURCE_PALETTE, getSourceColor, buildConicGradient } from "@/components/explorer/source-palette";
import {
  formatTimestamp, buildTrendCardKey, formatCompactTimestamp, formatDateOnly,
  buildShareActivityMap, formatRankChange, formatMomentum, formatMomentumHeadline,
  formatMomentumDetail, formatScoreMix, formatCollapsedSourceDriverSummary,
  formatCollapsedCorroborationSummary, movementClassName, compareDates,
  formatSourceStatus, formatCategory, sourceHealthClassName, contributionHealthClassName,
  formatWatchSeverity, formatDuration, formatShareTokenLabel, formatShareActivityTimestamp,
  formatTrendStatus, trendStatusClassName, formatVolatility, volatilityClassName,
  scaleValue, formatPercent, formatAlertRuleType, formatSourceContributionSummary,
  formatAudienceSummary, formatAudiencePrefix, formatAudienceLabel,
  formatConfidenceLabel, formatConfidenceBucketLabel, formatStageLabel,
  buildTrendAudienceBadge, summarizeTrendAudience, formatLanguageLabel,
  formatExplorerSortLabel, formatStatusLabel, getOpportunityScoreForLens,
  formatLensLabel, summarizeThesisFilters, getOptionLabel, formatGeoCountryLabel,
  isDataStale,
} from "@/components/explorer/format";
import {
  listActiveExplorerFilters, isThesisPresetApplied, shouldClearActiveThesisPreset,
  buildAudienceFilterOptions, buildMarketFilterOptions, buildLanguageFilterOptions,
} from "@/components/explorer/filters";
import {
  buildShareExpiryIso, defaultShareExpiryPreset, resolveShareExpiryIso,
  resolveDefaultShareExpiryDays, sharePresetToDays, formatShareDurationLabel,
  formatWatchlistDefaultShareExpiry, formatShareDefaultOptionLabel,
  fillShareHistory, formatShareExpirySummary,
} from "@/components/explorer/shares";
import {
  buildCommunitySpotlights, buildCommunityExportHref, buildSharedWatchlistExportHref,
} from "@/components/explorer/community";
import { BreakingFeedSection } from "@/components/explorer/breaking-feed-section";
```

- [ ] **Step 2: Remove all extracted code from dashboard-shell.tsx**

Delete the following sections (in order from bottom to top to preserve line numbers):
1. `buildConicGradient` function (lines 4328–4343)
2. `BreakingFeedSection` component (lines 4216–4326)
3. `getSourceColor` function (lines 4212–4214)
4. `SOURCE_PALETTE` constant (lines 4204–4210)
5. `isDataStale` function (lines 4198–4202)
6. All share helpers (lines 4100–4196)
7. `getOptionLabel` through `formatGeoCountryLabel` (lines 4085–4098)
8. `summarizeThesisFilters` (lines 4067–4083)
9. `formatLensLabel` (lines 4055–4065)
10. `getOpportunityScoreForLens` (lines 4030–4053)
11. `formatStatusLabel` (lines 4025–4028)
12. `formatExplorerSortLabel` (lines 4013–4023)
13. `formatLanguageLabel` (lines 3997–4011)
14. `summarizeTrendAudience` through `buildTrendAudienceBadge` (lines 3968–3995)
15. `formatStageLabel` through `formatConfidenceLabel` (lines 3946–3965)
16. `confidenceBucketForTrend` re-export (lines 3943–3944)
17. `buildSegmentFilterOptions` (lines 3921–3941)
18. `shouldClearActiveThesisPreset` (lines 3914–3919)
19. `isThesisPresetApplied` (lines 3887–3912)
20. `listActiveExplorerFilters` (lines 3764–3885)
21. `trendMatchesAudience/Market/Language` re-exports (lines 3761–3762)
22. `buildLanguageFilterOptions` through `buildAudienceFilterOptions` (lines 3731–3759)
23. `buildSharedWatchlistExportHref` (lines 3727–3729)
24. `buildCommunityExportHref` (lines 3723–3725)
25. `buildCommunitySpotlights` (lines 3648–3721)
26. All formatting functions (lines 3277–3646)
27. Type definitions: `ThesisPreset`, `ExplorerActiveFilter`, `ThesisPresetFilterState` (lines 228–364)
28. Constants: lines 106–226 (polling intervals, empty sentinels, filter options, sort options, watchlist flag)
29. Thesis presets: `THESIS_PRESET_ICONS` and `THESIS_PRESETS` (lines 243–325)
30. Replace `const EXPLORER_PAGE_SIZE = 20;` inside the component (line 447) with the import from constants

- [ ] **Step 3: Re-export extracted public functions for backwards compatibility**

At the bottom of `dashboard-shell.tsx`, add re-exports so existing consumers don't break:

```ts
// Re-exports for backwards compatibility — consumers should migrate to @/components/explorer/*
export {
  buildCommunitySpotlights,
  buildCommunityExportHref,
  buildSharedWatchlistExportHref,
  buildAudienceFilterOptions,
  buildMarketFilterOptions,
  buildLanguageFilterOptions,
  listActiveExplorerFilters,
  isThesisPresetApplied,
  shouldClearActiveThesisPreset,
};
export { trendMatchesAudience, trendMatchesMarket, trendMatchesLanguage } from "@/lib/trend-filters";
export { confidenceBucketForTrend } from "@/lib/trend-filters";
```

- [ ] **Step 4: Verify it compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add web/components/dashboard-shell.tsx
git commit -m "refactor: replace inline code in dashboard-shell with explorer module imports"
```

---

### Task 11: Update test imports

**Files:**
- Modify: `web/tests/dashboard-community-spotlights.test.ts`

- [ ] **Step 1: Update import paths**

Change the import from `@/components/dashboard-shell` to import from the specific explorer modules:

```ts
import {
  buildCommunitySpotlights,
  buildCommunityExportHref,
  buildSharedWatchlistExportHref,
} from "@/components/explorer/community";
import {
  buildAudienceFilterOptions,
  buildLanguageFilterOptions,
  buildMarketFilterOptions,
  isThesisPresetApplied,
  listActiveExplorerFilters,
  shouldClearActiveThesisPreset,
} from "@/components/explorer/filters";
import {
  trendMatchesAudience,
  trendMatchesLanguage,
  trendMatchesMarket,
} from "@/lib/trend-filters";
```

- [ ] **Step 2: Run the tests**

Run: `cd web && node --import tsx --test tests/dashboard-community-spotlights.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add web/tests/dashboard-community-spotlights.test.ts
git commit -m "refactor: update test imports to use explorer modules"
```

---

### Task 12: Full build verification

- [ ] **Step 1: Run full TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run full test suite**

Run: `cd web && node --import tsx --test tests/**/*.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Run Next.js build**

Run: `cd web && npx next build`
Expected: Build succeeds.

- [ ] **Step 4: Verify line count reduction**

Run: `wc -l web/components/dashboard-shell.tsx`
Expected: ~3200 lines (down from 4343).

- [ ] **Step 5: Verify no new file exceeds 200 lines**

Run: `wc -l web/components/explorer/*.ts web/components/explorer/*.tsx`
Expected: All files under 200 lines.

- [ ] **Step 6: Final commit (if any fixups were needed)**

```bash
git add -A web/components/explorer/ web/components/dashboard-shell.tsx
git commit -m "refactor: phase 1 dashboard-shell extraction complete"
```
