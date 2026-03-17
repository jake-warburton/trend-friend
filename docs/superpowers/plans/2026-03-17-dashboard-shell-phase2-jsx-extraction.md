# Dashboard Shell Phase 2: JSX Component Extraction & Dead Code Removal

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract JSX sections from dashboard-shell.tsx into focused sub-components and delete all dead watchlist/auth/share/notification code gated behind `WATCHLISTS_ENABLED = false`.

**Architecture:** Each extracted component receives only the data and callbacks it needs via props. Filter state stays in `DashboardShell` since it drives URL sync and cross-component coordination. Dead code deletion removes ~600 lines of handlers, ~20 state variables, ~100 lines of JSX, and related memos/effects/loaders.

**Tech Stack:** TypeScript, React, Next.js (App Router), Base UI components

---

## File Structure

| New/Modified File | Responsibility | ~Lines |
|---|---|---|
| Create: `web/components/explorer/explorer-card.tsx` | Single trend card article | ~180 |
| Create: `web/components/explorer/explorer-filters.tsx` | Advanced filters details panel + active filter chips | ~200 |
| Create: `web/components/explorer/explorer-pagination.tsx` | Pagination nav | ~80 |
| Create: `web/components/explorer/explorer-sidebar.tsx` | Discover aside (categories, breakout, rising, experimental) | ~100 |
| Create: `web/components/explorer/analytics-strip.tsx` | Bottom analytics section (3 cards) | ~90 |
| Create: `web/components/explorer/geo-footprint.tsx` | Geographic footprint map section | ~70 |
| Modify: `web/components/dashboard-shell.tsx` | Remove extracted JSX, delete dead code, compose sub-components | target ~800 |

---

### Task 1: Delete dead watchlist/auth/share/notification code

This is the safest first step — pure deletion, no new files, and since `WATCHLISTS_ENABLED = false`, nothing breaks.

**Files:**
- Modify: `web/components/dashboard-shell.tsx`

- [ ] **Step 1: Delete dead state variables**

Remove these state declarations (lines 194–233, selectively):
- `watchlistData`, `watchlistError`, `watchlistName`
- `authStatus`, `authMode`, `authUsername`, `authPassword`, `authDisplayName`, `authError`, `authPending`
- `shareExpiryPreset`, `alertThreshold`, `thesisName`, `notifyOnMatch`, `alertEvents`, `alertCount`
- `shareNotice`, `notificationNotice`, `notificationError`, `notificationChannels`, `notificationDestination`, `notificationLabel`, `notificationPending`
- `actionNotice`, `actionPending`, `watchlistLoading`, `publicWatchlists`

Keep: `breakingFeed`, `overviewMeta`, `liveUpdateState`, `changedTrendIds`, `expandedTrendId`, `currentPage`, `startAutoRefresh`

- [ ] **Step 2: Delete dead refs**

Remove: `alertsDetailsRef`, `runsDetailsRef`, `sourcesDetailsRef` (lines 261–263)

- [ ] **Step 3: Delete dead computed values and memos**

Remove these (lines 273–311):
- `defaultWatchlist`, `savedTheses`, `savedThesisMatches`, `watchlistsRequireAuth`, `shareActivityById`
- `shareUsageSummary` useMemo
- `communitySpotlights` useMemo
- `sourceWatchlist` useMemo (dead — computed but never referenced)
- `thesisMatchesById` useMemo
- `showActionNotice` function

- [ ] **Step 4: Delete dead effects**

Remove:
- Watchlist init effect (lines 876–886): `useEffect(() => { if (!WATCHLISTS_ENABLED) { ... } void loadAuthStatus(); ... }, [])`
- Share expiry preset sync effect (lines 1054–1056): `useEffect(() => { setShareExpiryPreset(...) }, [defaultWatchlist])`
- Screenshot panel effect: remove branches referencing `alertsDetailsRef` (line 901–902), `sourcesDetailsRef` (lines 895–896), and `runsDetailsRef` (lines 898–899) since those refs are deleted in Step 2. If the entire effect body becomes empty, delete the whole effect.

- [ ] **Step 5: Delete all dead handler and loader functions**

Remove these functions entirely (lines 1058–1689):
- `loadWatchlists`, `loadAuthStatus`, `handleCreateWatchlist`, `handleAuthSubmit`, `handleLogout`
- `handleToggleTracked`, `handleCreateAlert`, `handleSaveThesis`, `handleDeleteThesis`
- `loadAlertEvents`, `loadPublicWatchlists`, `loadNotificationChannels`
- `handleCreateNotificationChannel`, `handleTestNotificationChannel`, `handleDeleteNotificationChannel`
- `handleMarkAlertsRead`
- `handleCreateShare`, `handleSaveDefaultShareExpiry`, `handleRevokeShare`
- `handleToggleShareVisibility`, `handleToggleShareAttribution`, `handleSetShareExpiry`, `handleRotateShare`

- [ ] **Step 6: Delete dead JSX**

Remove the `WATCHLISTS_ENABLED` conditional block in the sidebar (lines 2757–2987):
```jsx
{WATCHLISTS_ENABLED ? (
  <>
    {/* Identity card, Alerts panel, Saved theses panel */}
  </>
) : null}
```

Also remove the save thesis panel (lines 1831–1865):
```jsx
{!watchlistsRequireAuth && defaultWatchlist != null ? (
  <div className="filter-field filter-field-wide thesis-filter-block">
    <span>Save current thesis</span>
    ...
  </div>
) : null}
```

- [ ] **Step 7: Remove unused imports**

Remove type imports that are now unused: `AlertEvent`, `AlertEventsResponse`, `AuthStatusResponse`, `NotificationChannel`, `NotificationChannelsResponse`, `PublicWatchlistSummary`, `PublicWatchlistsResponse`, `TrendThesis`, `TrendThesisMatch`, `Watchlist`, `WatchlistResponse`.

Remove function imports that are now unused: `downloadTrendsCsv`, `downloadWatchlistCsv`, `buildShareActivityMap`, `summarizeShareUsage`, `wasOpenedRecently`, `buildCommunitySpotlights`, `maskWebhookDestination`, `summarizeNotificationDelivery`, `buildSourceWatchlist`, `formatShareTokenLabel`, `formatShareActivityTimestamp`, `formatWatchSeverity`, `formatShareDurationLabel`, `formatWatchlistDefaultShareExpiry`, `formatShareDefaultOptionLabel`, `fillShareHistory`, `formatShareExpirySummary`, `defaultShareExpiryPreset`, `resolveShareExpiryIso`, `resolveDefaultShareExpiryDays`, `sharePresetToDays`, `buildShareExpiryIso`, `formatAlertRuleType`, `formatCompactTimestamp`, `summarizeThesisFilters`, `formatDuration`, `formatSourceStatus`, `sourceHealthClassName`, `contributionHealthClassName`, `describeSourceYield`, `summarizeSourceYield`, `isDataStale`, `formatTimestamp`, `compareDates`, `formatSourceContributionSummary`, `formatAudienceSummary`.

Also remove: `buildCommunityExportHref`, `buildSharedWatchlistExportHref` from re-exports at bottom (keep only the ones still needed).

- [ ] **Step 8: Verify and commit**

Run: `cd web && npx tsc --noEmit 2>&1 | grep -c "explorer/\|dashboard-shell"` — expect 0
Run: `cd web && npx next build` — expect success

```bash
git add web/components/dashboard-shell.tsx
git commit -m "refactor: delete dead watchlist/auth/share/notification code"
```

---

### Task 2: Extract `explorer-card.tsx`

**Files:**
- Create: `web/components/explorer/explorer-card.tsx`
- Modify: `web/components/dashboard-shell.tsx`

- [ ] **Step 1: Create the component**

Extract the trend card `<article>` JSX (currently in the `paginatedTrends.map(...)` block, lines ~2391–2607 after Task 1 deletions).

Props interface:
```ts
type ExplorerCardProps = {
  trend: TrendExplorerRecord;
  index: number;
  detail: TrendDetailRecord | undefined;
  sources: ExploreInitialData["overview"]["sources"];
  isUpdated: boolean;
};
```

The component computes `forecastBadge`, `seasonalityBadge`, `primaryEvidenceLink`, `wikipediaLink`, `audienceBadge`, `audienceSummary`, `evidencePreviewText`, `evidenceMeta`, `compactSummaryParts`, `sourceInsights` internally from the props — these are all derivable from `trend` + `detail` + `sources`.

Imports needed: `Link` from next/link, format functions from `./format`, `buildSourceContributionInsights` from `@/lib/source-health`, evidence/forecast/seasonality helpers from `@/lib/*`.

- [ ] **Step 2: Update dashboard-shell.tsx**

Replace the `paginatedTrends.map(...)` block with:
```tsx
paginatedTrends.map((trend, index) => (
  <ExplorerCard
    key={buildTrendCardKey(trend, index)}
    trend={trend}
    index={index}
    detail={detailsByTrendId.get(trend.id)}
    sources={overview.sources}
    isUpdated={changedTrendIds.includes(trend.id)}
  />
))
```

- [ ] **Step 3: Verify and commit**

Run: `cd web && npx next build` — expect success

```bash
git add web/components/explorer/explorer-card.tsx web/components/dashboard-shell.tsx
git commit -m "refactor: extract ExplorerCard component"
```

---

### Task 3: Extract `explorer-filters.tsx`

**Files:**
- Create: `web/components/explorer/explorer-filters.tsx`
- Modify: `web/components/dashboard-shell.tsx`

- [ ] **Step 1: Create the component**

Extract the `<details className="advanced-filters-panel">` block (lines ~1868–2348) and the active filters chip section (lines ~2350–2376).

Props interface:
```ts
type ExplorerFiltersProps = {
  keyword: string;
  onKeywordChange: (value: string) => void;
  selectedSource: string;
  onSourceChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedStage: string;
  onStageChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  selectedConfidence: string;
  onConfidenceChange: (value: string) => void;
  selectedLens: string;
  onLensChange: (value: string) => void;
  selectedMetaTrend: string;
  onMetaTrendChange: (value: string) => void;
  selectedAudience: string;
  onAudienceChange: (value: string) => void;
  selectedMarket: string;
  onMarketChange: (value: string) => void;
  selectedLanguage: string;
  onLanguageChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void; // parent's handleSortChange which also sets default direction
  sortDirection: "asc" | "desc";
  onSortDirectionToggle: () => void;
  minimumScore: number | null;
  onMinimumScoreChange: (value: number | null) => void;
  hideRecurring: boolean;
  onHideRecurringToggle: () => void;
  categoryOptions: Array<{ label: string; value: string }>;
  metaTrendOptions: Array<{ label: string; value: string }>;
  audienceOptions: Array<{ label: string; value: string }>;
  marketOptions: Array<{ label: string; value: string }>;
  languageOptions: Array<{ label: string; value: string }>;
  activeFilters: ExplorerActiveFilter[];
  onClearFilter: (key: string) => void;
  onClearAllFilters: () => void;
};
```

This component needs `"use client"` and imports `Select`, `Input`, `NumberField` from Base UI, plus constants from `./constants`.

The label computations (`selectedSourceLabel`, etc.) move inside this component since they're only used for display in the filter dropdowns.

- [ ] **Step 2: Update dashboard-shell.tsx**

Replace the filters `<details>` and active filters sections with:
```tsx
<ExplorerFilters
  keyword={keyword}
  onKeywordChange={setKeyword}
  selectedSource={selectedSource}
  onSourceChange={setSelectedSource}
  // ... all filter state + setters
  categoryOptions={categoryOptions}
  metaTrendOptions={metaTrendOptions}
  audienceOptions={audienceOptions}
  marketOptions={marketOptions}
  languageOptions={languageOptions}
  activeFilters={activeExplorerFilters}
  onClearFilter={clearExplorerFilter}
  onClearAllFilters={clearAllExplorerFilters}
/>
```

Remove the label computations from dashboard-shell (lines ~425–475) since they move into ExplorerFilters.

- [ ] **Step 3: Verify and commit**

Run: `cd web && npx next build` — expect success

```bash
git add web/components/explorer/explorer-filters.tsx web/components/dashboard-shell.tsx
git commit -m "refactor: extract ExplorerFilters component"
```

---

### Task 4: Extract `explorer-pagination.tsx`

**Files:**
- Create: `web/components/explorer/explorer-pagination.tsx`
- Modify: `web/components/dashboard-shell.tsx`

- [ ] **Step 1: Create the component**

Extract the `<nav className="explorer-pagination">` block (lines ~2609–2680).

Props interface:
```ts
type ExplorerPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};
```

- [ ] **Step 2: Update dashboard-shell.tsx**

Replace pagination nav with:
```tsx
<ExplorerPagination
  currentPage={safePage}
  totalPages={totalPages}
  onPageChange={goToPage}
/>
```

- [ ] **Step 3: Verify and commit**

Run: `cd web && npx next build` — expect success

```bash
git add web/components/explorer/explorer-pagination.tsx web/components/dashboard-shell.tsx
git commit -m "refactor: extract ExplorerPagination component"
```

---

### Task 5: Extract `explorer-sidebar.tsx`

**Files:**
- Create: `web/components/explorer/explorer-sidebar.tsx`
- Modify: `web/components/dashboard-shell.tsx`

- [ ] **Step 1: Create the component**

Extract the `<aside className="history-panel">` block (lines ~2684–2989, after dead code removal it will be ~2684–2755).

Props interface:
```ts
type ExplorerSidebarProps = {
  metaTrends: ExploreInitialData["overview"]["sections"]["metaTrends"];
  breakoutTrends: ExploreInitialData["overview"]["sections"]["breakoutTrends"];
  risingTrends: ExploreInitialData["overview"]["sections"]["risingTrends"];
  experimentalTrends: ExploreInitialData["overview"]["sections"]["experimentalTrends"];
};
```

Uses `Link` from next/link and `formatCategory` from `./format`.

- [ ] **Step 2: Update dashboard-shell.tsx**

Replace aside with:
```tsx
<ExplorerSidebar
  metaTrends={overview.sections.metaTrends}
  breakoutTrends={overview.sections.breakoutTrends}
  risingTrends={overview.sections.risingTrends}
  experimentalTrends={overview.sections.experimentalTrends}
/>
```

- [ ] **Step 3: Verify and commit**

Run: `cd web && npx next build` — expect success

```bash
git add web/components/explorer/explorer-sidebar.tsx web/components/dashboard-shell.tsx
git commit -m "refactor: extract ExplorerSidebar component"
```

---

### Task 6: Extract `analytics-strip.tsx`

**Files:**
- Create: `web/components/explorer/analytics-strip.tsx`
- Modify: `web/components/dashboard-shell.tsx`

- [ ] **Step 1: Create the component**

Extract the `<section className="analytics-strip">` block (lines ~2992–3068).

Props interface:
```ts
type AnalyticsStripProps = {
  topTrendScores: Array<{ label: string; value: number }>;
  sourceShare: Array<{ label: string; value: number }>;
  statusBreakdown: Array<{ label: string; value: number }>;
};
```

Uses `scaleValue`, `formatPercent`, `getSourceColor`, `buildConicGradient` from format/source-palette.

- [ ] **Step 2: Update dashboard-shell.tsx**

Replace analytics strip with:
```tsx
<AnalyticsStrip
  topTrendScores={overview.charts.topTrendScores}
  sourceShare={overview.charts.sourceShare}
  statusBreakdown={overview.charts.statusBreakdown}
/>
```

- [ ] **Step 3: Verify and commit**

Run: `cd web && npx next build` — expect success

```bash
git add web/components/explorer/analytics-strip.tsx web/components/dashboard-shell.tsx
git commit -m "refactor: extract AnalyticsStrip component"
```

---

### Task 7: Extract `geo-footprint.tsx`

**Files:**
- Create: `web/components/explorer/geo-footprint.tsx`
- Modify: `web/components/dashboard-shell.tsx`

- [ ] **Step 1: Create the component**

Extract the geo footprint section (lines ~1720–1775).

Props interface:
```ts
type GeoFootprintProps = {
  geoMapData: ReturnType<typeof buildExplorerGeoMapData>;
  filteredTrendCount: number;
  selectedGeoCountry: string;
  onGeoCountryChange: (value: string) => void;
  isLoading: boolean;
  isReady: boolean;
};
```

Uses `GeoMapClient` from `@/components/geo-map-client`.

- [ ] **Step 2: Update dashboard-shell.tsx**

Replace the geo conditional block with:
```tsx
<GeoFootprint
  geoMapData={explorerGeoMapData}
  filteredTrendCount={filteredTrends.length}
  selectedGeoCountry={selectedGeoCountry}
  onGeoCountryChange={setSelectedGeoCountry}
  isLoading={deferredDataState === "loading"}
  isReady={hasDeferredData && explorerGeoMapData.length > 0}
/>
```

- [ ] **Step 3: Verify and commit**

Run: `cd web && npx next build` — expect success

```bash
git add web/components/explorer/geo-footprint.tsx web/components/dashboard-shell.tsx
git commit -m "refactor: extract GeoFootprint component"
```

---

### Task 8: Clean up re-exports and final verification

**Files:**
- Modify: `web/components/dashboard-shell.tsx`

- [ ] **Step 1: Clean up re-exports**

Remove dead re-exports at bottom of file. After dead code removal, some of these are no longer needed:
- Remove `buildCommunityExportHref`, `buildSharedWatchlistExportHref` (no consumers after test update in Phase 1)
- Keep only re-exports that have external consumers

- [ ] **Step 2: Remove unused imports**

Scan the import block and remove any imports no longer referenced.

- [ ] **Step 3: Full verification**

Run: `cd web && npx tsc --noEmit 2>&1 | grep "explorer/\|dashboard-shell"` — expect 0
Run: `cd web && node --import tsx --test tests/dashboard-community-spotlights.test.ts` — expect 8 pass
Run: `cd web && npx next build` — expect success

- [ ] **Step 4: Verify line counts**

Run: `wc -l web/components/dashboard-shell.tsx web/components/explorer/*.ts web/components/explorer/*.tsx`
Expected: `dashboard-shell.tsx` at ~800–1000 lines, all new files under 200 lines.

- [ ] **Step 5: Final commit**

```bash
git add web/components/dashboard-shell.tsx web/components/explorer/
git commit -m "refactor: phase 2 dashboard-shell extraction complete"
```
