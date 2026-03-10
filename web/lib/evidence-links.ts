import type { TrendDetailRecord, TrendEvidenceItem } from "@/lib/types";

const SOURCE_PRIORITY: Record<string, number> = {
  hacker_news: 6,
  reddit: 5,
  github: 4,
  twitter: 4,
  google_trends: 3,
  wikipedia: 1,
};

export function getPrimaryEvidenceLink(
  detail: Pick<TrendDetailRecord, "evidenceItems" | "primaryEvidence"> | null | undefined,
): TrendEvidenceItem | null {
  if (detail?.primaryEvidence) {
    return {
      ...detail.primaryEvidence,
      geoFlags: [],
      geoCountryCode: null,
      geoRegion: null,
      geoDetectionMode: "unknown",
      geoConfidence: 0,
    };
  }
  const linkedItems = (detail?.evidenceItems ?? []).filter(
    (item) => typeof item.evidenceUrl === "string" && item.evidenceUrl.length > 0,
  );
  if (linkedItems.length === 0) {
    return null;
  }
  return [...linkedItems].sort(compareEvidenceItems)[0] ?? null;
}

function compareEvidenceItems(left: TrendEvidenceItem, right: TrendEvidenceItem): number {
  const sourceDelta = getSourcePriority(right.source) - getSourcePriority(left.source);
  if (sourceDelta !== 0) {
    return sourceDelta;
  }

  const valueDelta = right.value - left.value;
  if (valueDelta !== 0) {
    return valueDelta;
  }

  const timeDelta = Date.parse(right.timestamp) - Date.parse(left.timestamp);
  if (!Number.isNaN(timeDelta) && timeDelta !== 0) {
    return timeDelta;
  }

  return right.evidence.length - left.evidence.length;
}

function getSourcePriority(source: string): number {
  return SOURCE_PRIORITY[source] ?? 0;
}
