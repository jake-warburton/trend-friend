"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  useTransition,
} from "react";
import { useSearchParams } from "next/navigation";
import { UpgradeModal, useUpgradeGate } from "@/components/upgrade-modal";

import type {
  ExploreInitialData,
} from "@/lib/types";
import { THESIS_PRESETS, THESIS_PRESET_ICONS } from "@/components/explorer/thesis-presets";
import {
  buildTrendCardKey,
} from "@/components/explorer/format";
import {
  listActiveExplorerFilters, isThesisPresetApplied, shouldClearActiveThesisPreset,
  buildAudienceFilterOptions, buildMarketFilterOptions, buildLanguageFilterOptions,
} from "@/components/explorer/filters";
import { useExplorerFilters } from "@/components/explorer/use-explorer-filters";
import { useExplorerData } from "@/components/explorer/use-explorer-data";
import { useLiveUpdates } from "@/components/explorer/use-live-updates";
import { useFilteredTrends } from "@/components/explorer/use-filtered-trends";
import { BreakingFeedSection } from "@/components/explorer/breaking-feed-section";
import { TrendingCarousel } from "@/components/explorer/trending-carousel";
import { ExplorerCard } from "@/components/explorer/explorer-card";
import { ExplorerFilters } from "@/components/explorer/explorer-filters";
import { ExplorerPagination } from "@/components/explorer/explorer-pagination";
import { ExplorerSidebar } from "@/components/explorer/explorer-sidebar";
import { AnalyticsStrip } from "@/components/explorer/analytics-strip";
import { GeoFootprint } from "@/components/explorer/geo-footprint";

type DashboardShellProps = {
  initialData: ExploreInitialData;
};

export function DashboardShell({
  initialData,
}: DashboardShellProps) {
  const searchParams = useSearchParams();
  const { modalOpen: upgradeModalOpen, closeModal: closeUpgradeModal, requirePro } = useUpgradeGate();
  const [isPending, startTransition] = useTransition();
  const [trendingTopics, setTrendingTopics] = useState<Array<{name: string; category: string; location: string; tweet_volume: number | null; domain_context: string | null; fetched_at: string}> | null>(null);

  const screenshotMode = searchParams.get("screenshot") === "1";
  const screenshotPanel = searchParams.get("panel");
  const screenshotTrendId = searchParams.get("trend");
  const overview = initialData.overview;

  const filters = useExplorerFilters();
  const explorerData = useExplorerData(initialData);
  const liveUpdates = useLiveUpdates(initialData, screenshotMode);
  const trends = useFilteredTrends({
    explorerTrends: initialData.explorer.trends,
    detailsByTrendId: explorerData.detailsByTrendId,
    deferredKeyword: filters.deferredKeyword,
    selectedSource: filters.selectedSource,
    selectedCategory: filters.selectedCategory,
    selectedStage: filters.selectedStage,
    selectedConfidence: filters.selectedConfidence,
    selectedLens: filters.selectedLens,
    selectedMetaTrend: filters.selectedMetaTrend,
    selectedAudience: filters.selectedAudience,
    selectedMarket: filters.selectedMarket,
    selectedLanguage: filters.selectedLanguage,
    selectedGeoCountry: filters.selectedGeoCountry,
    minimumScore: filters.minimumScore,
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection,
    selectedStatus: filters.selectedStatus,
    hideRecurring: filters.hideRecurring,
    currentPage: filters.currentPage,
    setCurrentPage: filters.setCurrentPage,
  });

  useEffect(() => {
    if (screenshotTrendId) {
      trends.handleToggleExpand(screenshotTrendId);
    }
  }, [screenshotTrendId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function fetchTrendingTopics() {
      try {
        const response = await fetch("/api/trends/hashtags");
        if (response.ok) {
          const data = await response.json();
          setTrendingTopics(data.trends ?? []);
        }
      } catch { /* ignore */ }
    }
    void fetchTrendingTopics();
  }, []);

  return (
    <main
      className={
        screenshotMode
          ? "dashboard-page dashboard-page-screenshot"
          : "dashboard-page"
      }
      data-screenshot-target="explore"
      data-screenshot-panel={screenshotPanel ?? undefined}
    >
      {/* ── Top 5 Trends ──────────────────────────────────── */}
      <section className="top-trends-strip">
        {overview.sections.topTrends.slice(0, 5).map((trend, i) => (
          <Link
            className="top-trend-chip"
            href={`/trends/${trend.id}`}
            key={trend.id}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="top-trend-rank">#{trend.rank}</span>
            <span className="top-trend-name">{trend.name}</span>
            <span className="top-trend-score">{trend.scoreTotal.toFixed(1)}</span>
          </Link>
        ))}
      </section>

      {/* ── Trending on X ──────────────────────────────────── */}
      <TrendingCarousel trends={trendingTopics} />

      {/* ── Breaking Feed ─────────────────────────────────── */}
      <BreakingFeedSection feed={liveUpdates.breakingFeed} />

      <GeoFootprint
        geoMapData={trends.explorerGeoMapData}
        filteredTrendCount={trends.filteredTrends.length}
        selectedGeoCountry={filters.selectedGeoCountry}
        onGeoCountryChange={filters.setSelectedGeoCountry}
        isLoading={explorerData.deferredDataState === "loading"}
        isReady={explorerData.hasDeferredData && trends.explorerGeoMapData.length > 0}
      />

      <section className="content-grid">
        <div className="ranking-panel">
          <div className="section-heading" id="explorer-heading">
            <h2>Explorer</h2>
            <div className="section-heading-actions">
              <button
                className="mini-action-button export-button"
                type="button"
                onClick={() => {
                  requirePro(() => {
                    window.location.href = filters.exportHref;
                  });
                }}
              >
                Export CSV
              </button>
              <span className="section-heading-meta">
                {trends.filteredTrends.length} live · page {trends.safePage} of {trends.totalPages}
              </span>
            </div>
          </div>

          <div
            className={
              isPending
                ? "explorer-list explorer-list-pending"
                : "explorer-list"
            }
            aria-busy={isPending}
          >
            <section className="thesis-filters-panel">
              <div className="filter-field filter-field-wide thesis-filter-block">
                <span>Thesis presets</span>
                <div className="thesis-presets-grid">
                  {THESIS_PRESETS.map((preset) => (
                    <button
                      aria-pressed={filters.activeThesisPresetKey === preset.key}
                      className={
                        filters.activeThesisPresetKey === preset.key
                          ? "thesis-preset-card thesis-preset-card-active"
                          : "thesis-preset-card"
                      }
                      key={preset.key}
                      onClick={() => filters.applyThesisPreset(preset)}
                      type="button"
                    >
                      {THESIS_PRESET_ICONS[preset.key] ?? null}
                      <strong>{preset.label}</strong>
                      <small>{preset.description}</small>
                    </button>
                  ))}
                </div>
              </div>

            </section>

            <ExplorerFilters
              keyword={filters.keyword}
              onKeywordChange={filters.setKeyword}
              selectedSource={filters.selectedSource}
              onSourceChange={(v) => filters.setSelectedSource(v ?? "all")}
              selectedCategory={filters.selectedCategory}
              onCategoryChange={(v) => filters.setSelectedCategory(v ?? "all")}
              selectedStage={filters.selectedStage}
              onStageChange={(v) => filters.setSelectedStage(v ?? "all")}
              selectedStatus={filters.selectedStatus}
              onStatusChange={(v) => filters.setSelectedStatus(v ?? "all")}
              selectedConfidence={filters.selectedConfidence}
              onConfidenceChange={(v) => filters.setSelectedConfidence(v ?? "all")}
              selectedLens={filters.selectedLens}
              onLensChange={(v) => filters.setSelectedLens(v ?? "all")}
              selectedMetaTrend={filters.selectedMetaTrend}
              onMetaTrendChange={(v) => filters.setSelectedMetaTrend(v ?? "all")}
              selectedAudience={filters.selectedAudience}
              onAudienceChange={(v) => filters.setSelectedAudience(v ?? "all")}
              selectedMarket={filters.selectedMarket}
              onMarketChange={(v) => filters.setSelectedMarket(v ?? "all")}
              selectedLanguage={filters.selectedLanguage}
              onLanguageChange={(v) => filters.setSelectedLanguage(v ?? "all")}
              sortBy={filters.sortBy}
              onSortChange={(v) => filters.handleSortChange(v ?? "rank")}
              sortDirection={filters.sortDirection}
              onSortDirectionToggle={() => filters.setSortDirection((d) => d === "asc" ? "desc" : "asc")}
              minimumScore={filters.minimumScore}
              onMinimumScoreChange={filters.setMinimumScore}
              hideRecurring={filters.hideRecurring}
              onHideRecurringToggle={() => filters.setHideRecurring((c) => !c)}
              categoryOptions={explorerData.categoryOptions}
              metaTrendOptions={explorerData.metaTrendOptions}
              audienceOptions={explorerData.audienceOptions}
              marketOptions={explorerData.marketOptions}
              languageOptions={explorerData.languageOptions}
              activeFilters={filters.activeExplorerFilters}
              onClearFilter={filters.clearExplorerFilter}
              onClearAllFilters={filters.clearAllExplorerFilters}
            />

            <div className="explorer-legend" aria-hidden="true">
              <span>Trend</span>
              <span>Metrics</span>
            </div>
            {trends.filteredTrends.length === 0 ? (
              <div className="empty-state">
                <h3>No trends match these filters.</h3>
                <p>
                  Lower the minimum score or broaden the keyword and source
                  filters.
                </p>
              </div>
            ) : (
              trends.paginatedTrends.map((trend, index) => (
                <ExplorerCard
                  key={buildTrendCardKey(trend, index)}
                  trend={trend}
                  index={index}
                  detail={explorerData.detailsByTrendId.get(trend.id)}
                  sources={overview.sources}
                  isUpdated={liveUpdates.changedTrendIds.includes(trend.id)}
                />
              ))
            )}
            <ExplorerPagination
              currentPage={trends.safePage}
              totalPages={trends.totalPages}
              onPageChange={trends.goToPage}
            />
          </div>
        </div>

        <ExplorerSidebar
          metaTrends={overview.sections.metaTrends}
          breakoutTrends={overview.sections.breakoutTrends}
          risingTrends={overview.sections.risingTrends}
          experimentalTrends={overview.sections.experimentalTrends}
        />
      </section>

      <AnalyticsStrip
        topTrendScores={overview.charts.topTrendScores}
        sourceShare={overview.charts.sourceShare}
        statusBreakdown={overview.charts.statusBreakdown}
      />
      <UpgradeModal open={upgradeModalOpen} onClose={closeUpgradeModal} feature="CSV export" />
    </main>
  );
}

// Re-exports for backwards compatibility — consumers should migrate to @/components/explorer/*
export {
  buildAudienceFilterOptions,
  buildMarketFilterOptions,
  buildLanguageFilterOptions,
  listActiveExplorerFilters,
  isThesisPresetApplied,
  shouldClearActiveThesisPreset,
};
export { trendMatchesAudience, trendMatchesMarket, trendMatchesLanguage } from "@/lib/trend-filters";
export { confidenceBucketForTrend } from "@/lib/trend-filters";
