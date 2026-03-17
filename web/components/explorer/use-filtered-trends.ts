import { useState, useEffect, useMemo } from "react";
import type { ExploreInitialData, TrendDetailRecord } from "@/lib/types";
import {
  confidenceBucketForTrend,
  trendMatchesAudience,
  trendMatchesMarket,
  trendMatchesLanguage,
} from "@/lib/trend-filters";
import { trendMatchesGeo, buildExplorerGeoMapData } from "@/lib/explorer-geo";
import { isRecurringTrend } from "@/lib/seasonality-ui";
import { compareDates, getOpportunityScoreForLens } from "./format";
import { EXPLORER_PAGE_SIZE } from "./constants";

type UseFilteredTrendsInput = {
  explorerTrends: ExploreInitialData["explorer"]["trends"];
  detailsByTrendId: Map<string, TrendDetailRecord>;
  deferredKeyword: string;
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
  currentPage: number;
  setCurrentPage: (page: number) => void;
};

export function useFilteredTrends(input: UseFilteredTrendsInput) {
  const {
    explorerTrends,
    detailsByTrendId,
    deferredKeyword,
    selectedSource,
    selectedCategory,
    selectedStage,
    selectedConfidence,
    selectedLens,
    selectedMetaTrend,
    selectedAudience,
    selectedMarket,
    selectedLanguage,
    selectedGeoCountry,
    minimumScore,
    sortBy,
    sortDirection,
    selectedStatus,
    hideRecurring,
    currentPage,
    setCurrentPage,
  } = input;

  const [expandedTrendId, setExpandedTrendId] = useState<string | null>(null);

  const baseFilteredTrends = useMemo(() => {
    const normalizedKeyword = deferredKeyword.trim().toLowerCase();
    const minimum = minimumScore ?? 0;
    const trends = explorerTrends.filter((trend) => {
      const detail = detailsByTrendId.get(trend.id);
      const matchesSource =
        selectedSource === "all" || trend.sources.includes(selectedSource);
      const matchesCategory =
        selectedCategory === "all" || trend.category === selectedCategory;
      const matchesStage =
        selectedStage === "all" || trend.stage === selectedStage;
      const matchesConfidence =
        selectedConfidence === "all" ||
        confidenceBucketForTrend(trend.confidence) === selectedConfidence;
      const matchesMetaTrend =
        selectedMetaTrend === "all" || trend.metaTrend === selectedMetaTrend;
      const matchesAudience = trendMatchesAudience(detail, selectedAudience);
      const matchesMarket = trendMatchesMarket(detail, selectedMarket);
      const matchesLanguage = trendMatchesLanguage(detail, selectedLanguage);
      const matchesGeo = trendMatchesGeo(detail, selectedGeoCountry);
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        trend.name.toLowerCase().includes(normalizedKeyword) ||
        trend.evidencePreview.some((item) =>
          item.toLowerCase().includes(normalizedKeyword),
        );
      const matchesScore = trend.score.total >= minimum;
      const matchesSeasonality =
        !hideRecurring || !isRecurringTrend(trend.seasonality);
      const matchesStatus =
        selectedStatus === "all" || trend.status === selectedStatus;
      return (
        matchesSource &&
        matchesCategory &&
        matchesStage &&
        matchesConfidence &&
        matchesMetaTrend &&
        matchesAudience &&
        matchesMarket &&
        matchesLanguage &&
        matchesGeo &&
        matchesKeyword &&
        matchesScore &&
        matchesSeasonality &&
        matchesStatus
      );
    });

    const dir = sortDirection === "asc" ? 1 : -1;
    return [...trends].sort((left, right) => {
      const leftDetail = detailsByTrendId.get(left.id);
      const rightDetail = detailsByTrendId.get(right.id);
      if (selectedLens !== "all") {
        const lensDelta =
          getOpportunityScoreForLens(rightDetail, selectedLens) -
          getOpportunityScoreForLens(leftDetail, selectedLens);
        if (lensDelta !== 0) {
          return lensDelta;
        }
      }
      if (sortBy === "strength") {
        return (
          dir * (left.score.total - right.score.total) ||
          left.rank - right.rank
        );
      }
      if (sortBy === "dateAdded") {
        return (
          dir * compareDates(left.firstSeenAt, right.firstSeenAt) ||
          left.rank - right.rank
        );
      }
      if (sortBy === "latestActivity") {
        return (
          dir * compareDates(left.latestSignalAt, right.latestSignalAt) ||
          left.rank - right.rank
        );
      }
      if (sortBy === "sources") {
        return (
          dir * (left.coverage.sourceCount - right.coverage.sourceCount) ||
          left.rank - right.rank
        );
      }
      if (sortBy === "momentum") {
        return (
          dir *
            ((left.momentum.absoluteDelta ?? 0) -
              (right.momentum.absoluteDelta ?? 0)) || left.rank - right.rank
        );
      }
      return dir * (left.rank - right.rank);
    });
  }, [
    deferredKeyword,
    detailsByTrendId,
    hideRecurring,
    explorerTrends,
    minimumScore,
    selectedAudience,
    selectedCategory,
    selectedConfidence,
    selectedGeoCountry,
    selectedLanguage,
    selectedLens,
    selectedMarket,
    selectedMetaTrend,
    selectedSource,
    selectedStage,
    selectedStatus,
    sortBy,
    sortDirection,
  ]);

  const explorerGeoMapData = useMemo(
    () => buildExplorerGeoMapData(baseFilteredTrends, detailsByTrendId),
    [baseFilteredTrends, detailsByTrendId],
  );

  const filteredTrends = baseFilteredTrends;

  const totalPages = Math.max(1, Math.ceil(filteredTrends.length / EXPLORER_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTrends = filteredTrends.slice(
    (safePage - 1) * EXPLORER_PAGE_SIZE,
    safePage * EXPLORER_PAGE_SIZE,
  );

  function handleToggleExpand(trendId: string) {
    setExpandedTrendId((prev) => (prev === trendId ? null : trendId));
  }

  function goToPage(page: number) {
    setCurrentPage(page);
    setExpandedTrendId(null);
    document.getElementById("explorer-heading")?.scrollIntoView({ behavior: "instant", block: "start" });
  }

  useEffect(() => {
    if (
      expandedTrendId != null &&
      !filteredTrends.some((t) => t.id === expandedTrendId)
    ) {
      setExpandedTrendId(null);
    }
  }, [filteredTrends, expandedTrendId]);

  return {
    filteredTrends,
    paginatedTrends,
    totalPages,
    safePage,
    explorerGeoMapData,
    expandedTrendId,
    handleToggleExpand,
    goToPage,
  };
}
