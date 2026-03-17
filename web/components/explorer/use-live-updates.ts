"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExploreInitialData, BreakingFeed } from "@/lib/types";
import {
  detectChangedTrendIds,
  hasOverviewChanged,
} from "@/lib/auto-refresh";
import type { OverviewRefreshMeta } from "@/lib/auto-refresh";
import {
  OVERVIEW_POLL_INTERVAL_MS,
  UPDATED_TRENDS_FLASH_MS,
} from "./constants";

export function useLiveUpdates(
  initialData: ExploreInitialData,
  screenshotMode: boolean,
) {
  const router = useRouter();
  const overview = initialData.overview;
  const explorer = initialData.explorer;

  const [overviewMeta, setOverviewMeta] = useState({
    generatedAt: initialData.overview.generatedAt,
    lastRunAt: initialData.overview.operations.lastRunAt,
  });
  const [liveUpdateState, setLiveUpdateState] = useState<
    "idle" | "checking" | "updating" | "updated"
  >("idle");
  const [changedTrendIds, setChangedTrendIds] = useState<string[]>([]);
  const [breakingFeed, setBreakingFeed] = useState<BreakingFeed | null>(null);
  const [, startAutoRefresh] = useTransition();
  const overviewMetaRef = useRef<OverviewRefreshMeta>({
    generatedAt: initialData.overview.generatedAt,
    operations: { lastRunAt: initialData.overview.operations.lastRunAt },
  });
  const explorerTrendRef = useRef(
    initialData.explorer.trends.map((trend) => ({
      id: trend.id,
      rank: trend.rank,
      score: { total: trend.score.total },
    })),
  );
  const initialRenderRef = useRef(true);
  const updatedBadgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const nextOverviewMeta = {
      generatedAt: overview.generatedAt,
      operations: { lastRunAt: overview.operations.lastRunAt },
    };
    const nextExplorerTrends = explorer.trends.map((trend) => ({
      id: trend.id,
      rank: trend.rank,
      score: { total: trend.score.total },
    }));

    const overviewChanged = hasOverviewChanged(
      overviewMetaRef.current,
      nextOverviewMeta,
    );
    const changedIds = detectChangedTrendIds(
      explorerTrendRef.current,
      nextExplorerTrends,
    );

    overviewMetaRef.current = nextOverviewMeta;
    explorerTrendRef.current = nextExplorerTrends;
    setOverviewMeta({
      generatedAt: nextOverviewMeta.generatedAt,
      lastRunAt: nextOverviewMeta.operations.lastRunAt,
    });

    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }

    if (overviewChanged) {
      setLiveUpdateState("updated");
      setChangedTrendIds(changedIds);
      if (updatedBadgeTimeoutRef.current) {
        clearTimeout(updatedBadgeTimeoutRef.current);
      }
      updatedBadgeTimeoutRef.current = setTimeout(() => {
        setLiveUpdateState("idle");
        setChangedTrendIds([]);
      }, UPDATED_TRENDS_FLASH_MS);
    }
  }, [explorer.trends, overview]);

  useEffect(() => {
    async function fetchBreakingFeed() {
      try {
        const response = await fetch("/api/breaking");
        if (response.ok) {
          const feed = await response.json();
          setBreakingFeed(feed);
        }
      } catch { /* ignore fetch errors */ }
    }
    void fetchBreakingFeed();
    const intervalId = window.setInterval(() => {
      void fetchBreakingFeed();
    }, 300_000); // 5 minutes
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void fetchBreakingFeed();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (screenshotMode) {
      return;
    }
    const intervalId = window.setInterval(async () => {
      setLiveUpdateState((current) =>
        current === "updating" ? current : "checking",
      );
      try {
        const response = await fetch("/api/dashboard/overview");
        if (!response.ok) {
          setLiveUpdateState("idle");
          return;
        }
        const nextOverview = (await response.json()) as OverviewRefreshMeta;
        if (!hasOverviewChanged(overviewMetaRef.current, nextOverview)) {
          setLiveUpdateState("idle");
          return;
        }
        setLiveUpdateState("updating");
        startAutoRefresh(() => {
          router.refresh();
        });
      } catch {
        setLiveUpdateState("idle");
      }
    }, OVERVIEW_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      if (updatedBadgeTimeoutRef.current) {
        clearTimeout(updatedBadgeTimeoutRef.current);
      }
    };
  }, [router, screenshotMode, startAutoRefresh]);

  return { overviewMeta, liveUpdateState, changedTrendIds, breakingFeed };
}
