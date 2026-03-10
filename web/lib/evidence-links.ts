import type { TrendDetailRecord, TrendEvidenceItem } from "@/lib/types";

export function getPrimaryEvidenceLink(
  detail: Pick<TrendDetailRecord, "evidenceItems"> | null | undefined,
): TrendEvidenceItem | null {
  return detail?.evidenceItems.find((item) => typeof item.evidenceUrl === "string" && item.evidenceUrl.length > 0) ?? null;
}
