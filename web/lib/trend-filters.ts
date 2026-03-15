/**
 * Shared trend filtering utilities used by both the dashboard shell (client)
 * and API export routes (server). Extracted from dashboard-shell.tsx to avoid
 * importing a "use client" component in server-side API routes.
 */

import type { TrendDetailRecord } from "@/lib/types";

export function confidenceBucketForTrend(confidence: number) {
  if (confidence >= 0.75) {
    return "high";
  }
  if (confidence >= 0.5) {
    return "medium";
  }
  return "low";
}

export function trendMatchesAudience(
  detail: TrendDetailRecord | undefined,
  selectedAudience: string,
) {
  return trendMatchesSegment(detail, selectedAudience, "audience");
}

export function trendMatchesMarket(
  detail: TrendDetailRecord | undefined,
  selectedMarket: string,
) {
  return trendMatchesSegment(detail, selectedMarket, "market");
}

export function trendMatchesLanguage(
  detail: TrendDetailRecord | undefined,
  selectedLanguage: string,
) {
  if (selectedLanguage === "all") {
    return true;
  }
  return (detail?.evidenceItems ?? []).some(
    (item) => item.languageCode?.toLowerCase() === selectedLanguage,
  );
}

function trendMatchesSegment(
  detail: TrendDetailRecord | undefined,
  selectedValue: string,
  segmentType: string,
) {
  if (selectedValue === "all") {
    return true;
  }
  return (detail?.audienceSummary ?? []).some(
    (item) => item.segmentType === segmentType && item.label === selectedValue,
  );
}
