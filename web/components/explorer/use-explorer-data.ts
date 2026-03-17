import { useState, useEffect, useMemo } from "react";
import type {
  ExploreDeferredData,
  ExploreInitialData,
  TrendDetailRecord,
} from "@/lib/types";
import {
  EMPTY_HISTORY,
  EMPTY_DETAIL_INDEX,
  EMPTY_SOURCE_SUMMARY,
  DEFAULT_CATEGORY_OPTION,
  DEFAULT_META_TREND_OPTION,
} from "./constants";
import { formatCategory } from "./format";
import {
  buildAudienceFilterOptions,
  buildMarketFilterOptions,
  buildLanguageFilterOptions,
} from "./filters";
import { buildSourceImpactRows } from "@/lib/source-impact";
import {
  buildSourceFamilyInsights,
  buildSourceFamilyHistoryInsightsFromSnapshots,
  buildSourceFamilyHistoryInsights,
} from "@/lib/source-health";

export function useExplorerData(initialData: ExploreInitialData) {
  const overview = initialData.overview;
  const explorer = initialData.explorer;

  const [deferredData, setDeferredData] = useState<ExploreDeferredData | null>(
    null,
  );
  const [deferredDataState, setDeferredDataState] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const history = deferredData?.history ?? EMPTY_HISTORY;
  const details = deferredData?.details ?? EMPTY_DETAIL_INDEX;
  const sourceSummary = deferredData?.sourceSummary ?? EMPTY_SOURCE_SUMMARY;
  const hasDeferredData = deferredDataState === "ready";

  useEffect(() => {
    const abortController = new AbortController();

    async function loadDeferredExploreData() {
      setDeferredDataState("loading");
      try {
        const response = await fetch("/api/explore/bootstrap", {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`Bootstrap unavailable (${response.status})`);
        }
        const payload = (await response.json()) as ExploreDeferredData;
        if (!abortController.signal.aborted) {
          setDeferredData(payload);
          setDeferredDataState("ready");
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        setDeferredDataState("error");
        if (error instanceof Error) {
          console.error("Failed to load deferred explorer data", error);
        }
      }
    }

    void loadDeferredExploreData();
    return () => abortController.abort();
  }, [explorer.generatedAt, overview.generatedAt]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(explorer.trends.map((trend) => trend.category)),
    ).sort();
    return [
      DEFAULT_CATEGORY_OPTION,
      ...categories.map((category) => ({
        label: formatCategory(category),
        value: category,
      })),
    ];
  }, [explorer.trends]);

  const audienceOptions = useMemo(
    () => buildAudienceFilterOptions(details.trends),
    [details.trends],
  );
  const metaTrendOptions = useMemo(() => {
    const metaTrends = Array.from(
      new Set(explorer.trends.map((trend) => trend.metaTrend)),
    ).sort();
    return [
      DEFAULT_META_TREND_OPTION,
      ...metaTrends.map((metaTrend) => ({
        label: metaTrend,
        value: metaTrend,
      })),
    ];
  }, [explorer.trends]);
  const marketOptions = useMemo(
    () => buildMarketFilterOptions(details.trends),
    [details.trends],
  );
  const languageOptions = useMemo(
    () => buildLanguageFilterOptions(details.trends),
    [details.trends],
  );

  const detailsByTrendId = useMemo(() => {
    const map = new Map<string, TrendDetailRecord>();
    for (const detail of details.trends) {
      map.set(detail.id, detail);
    }
    return map;
  }, [details.trends]);
  const sourceImpactRows = useMemo(
    () =>
      buildSourceImpactRows(
        overview.sources,
        explorer.trends,
        detailsByTrendId,
      ),
    [
      detailsByTrendId,
      explorer.trends,
      overview.sources,
    ],
  );
  const sourceFamilyInsights = useMemo(
    () => buildSourceFamilyInsights(overview.sources),
    [overview.sources],
  );
  const sourceFamilyHistoryInsights = useMemo(
    () =>
      sourceSummary.familyHistory.length > 0
        ? buildSourceFamilyHistoryInsightsFromSnapshots(
            sourceSummary.familyHistory,
          )
        : buildSourceFamilyHistoryInsights(sourceSummary.sources),
    [
      sourceSummary.familyHistory,
      sourceSummary.sources,
    ],
  );

  return {
    deferredDataState,
    hasDeferredData,
    detailsByTrendId,
    categoryOptions,
    metaTrendOptions,
    audienceOptions,
    marketOptions,
    languageOptions,
    sourceImpactRows,
    sourceFamilyInsights,
    sourceFamilyHistoryInsights,
    history,
    details,
    sourceSummary,
  };
}
