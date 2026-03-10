import type { SeasonalitySummary } from "@/lib/types";

export function getSeasonalityBadge(
  seasonality: SeasonalitySummary | null | undefined,
): { label: string; tone: "recurring" | "evergreen" } | null {
  if (seasonality?.tag === "recurring") {
    return { label: "Recurring", tone: "recurring" };
  }
  if (seasonality?.tag === "evergreen") {
    return { label: "Evergreen", tone: "evergreen" };
  }
  return null;
}

export function summarizeSeasonality(seasonality: SeasonalitySummary | null | undefined): string {
  if (seasonality?.tag === "recurring") {
    return `${seasonality.recurrenceCount} reappearances after gaps averaging ${seasonality.avgGapRuns.toFixed(1)} runs`;
  }
  if (seasonality?.tag === "evergreen") {
    return "Consistent presence across recent runs";
  }
  return "No recurring pattern detected";
}

export function isRecurringTrend(seasonality: SeasonalitySummary | null | undefined): boolean {
  return seasonality?.tag === "recurring";
}
