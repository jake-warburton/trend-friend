import type { TrendDetailRecord, TrendEvidenceItem } from "@/lib/types";

const SOURCE_PRIORITY: Record<string, number> = {
  hacker_news: 6,
  reddit: 5,
  github: 4,
  twitter: 4,
  google_trends: 3,
  wikipedia: 1,
};
const MAX_EVIDENCE_PREVIEW_LENGTH = 120;
const LEADING_LABEL_PATTERN = /^(show hn|launch hn|ask hn|tell hn|psa|breaking|update)\s*:\s*/i;
const REPOSITORY_PREFIX_PATTERN = /^\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\s+/;

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

export function summarizeEvidencePreview(evidence: string, source?: string): string {
  const normalized = evidence.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "No evidence available.";
  }

  let preview = normalized.replace(LEADING_LABEL_PATTERN, "");

  if (source === "github") {
    const repositoryMatch = preview.match(REPOSITORY_PREFIX_PATTERN);
    if (repositoryMatch) {
      const repository = repositoryMatch[1];
      const remainder = preview.slice(repositoryMatch[0].length).trim();
      preview = remainder ? `${repository}: ${remainder}` : repository;
    }
  }

  return truncateEvidencePreview(preview, MAX_EVIDENCE_PREVIEW_LENGTH);
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

function truncateEvidencePreview(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  const trimmed = value.slice(0, limit - 1);
  const safeBoundary = Math.max(trimmed.lastIndexOf(" "), trimmed.lastIndexOf(":"), trimmed.lastIndexOf("–"));
  const candidate = safeBoundary >= 48 ? trimmed.slice(0, safeBoundary) : trimmed;
  return `${candidate.trimEnd()}…`;
}
