import type { PublicWatchlistsResponse, SharedWatchlistResponse, TrendAudienceSegment } from "@/lib/types";

function escapeField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function summarizeSegments(summary: TrendAudienceSegment[] | undefined, segmentType: string): string {
  return (summary ?? [])
    .filter((item) => item.segmentType === segmentType)
    .map((item) => item.label)
    .join(",");
}

function summarizeGeoLabels(labels: Array<{ label: string }> | undefined): string {
  return (labels ?? []).map((item) => item.label).join(",");
}

function summarizeSources(sources: string[] | undefined): string {
  return (sources ?? []).join(",");
}

export const SHARED_WATCHLIST_CSV_COLUMNS = [
  "rank",
  "name",
  "category",
  "status",
  "current_score",
  "rank_change",
  "sources",
  "audience_segments",
  "market_segments",
  "language_segments",
  "geo_summary",
  "top_source",
  "top_source_share_pct",
  "added_at",
] as const;

export const COMMUNITY_WATCHLISTS_CSV_COLUMNS = [
  "name",
  "item_count",
  "owner_display_name",
  "recent_open_count",
  "access_count",
  "popular_this_week",
  "categories",
  "statuses",
  "top_source",
  "top_source_share_pct",
  "audience_segments",
  "market_segments",
  "language_segments",
  "geo_summary",
  "share_token",
  "expires_at",
  "created_at",
  "updated_at",
] as const;

export function buildSharedWatchlistCsv(payload: SharedWatchlistResponse): string {
  const rows = [SHARED_WATCHLIST_CSV_COLUMNS.join(",")];
  for (const item of payload.watchlist.items) {
    rows.push(
      [
        item.rank != null ? String(item.rank) : "",
        escapeField(item.trendName),
        escapeField(item.category ?? ""),
        item.status ?? "",
        item.currentScore != null ? String(item.currentScore) : "",
        item.rankChange != null ? String(item.rankChange) : "",
        escapeField(summarizeSources(item.sources)),
        escapeField(summarizeSegments(item.audienceSummary, "audience")),
        escapeField(summarizeSegments(item.audienceSummary, "market")),
        escapeField(summarizeSegments(item.audienceSummary, "language")),
        escapeField(summarizeGeoLabels(item.geoSummary)),
        item.sourceContributions?.[0]?.source ?? "",
        item.sourceContributions?.[0] != null ? String(item.sourceContributions[0].scoreSharePercent) : "",
        item.addedAt,
      ].join(","),
    );
  }
  return rows.join("\n") + "\n";
}

export function buildCommunityWatchlistsCsv(payload: PublicWatchlistsResponse): string {
  const rows = [COMMUNITY_WATCHLISTS_CSV_COLUMNS.join(",")];
  for (const watchlist of payload.watchlists) {
    rows.push(
      [
        escapeField(watchlist.name),
        String(watchlist.itemCount),
        escapeField(watchlist.ownerDisplayName ?? ""),
        String(watchlist.recentOpenCount ?? 0),
        String(watchlist.accessCount ?? 0),
        watchlist.popularThisWeek ? "true" : "false",
        escapeField((watchlist.categories ?? []).join(",")),
        escapeField((watchlist.statuses ?? []).join(",")),
        watchlist.sourceContributions?.[0]?.source ?? "",
        watchlist.sourceContributions?.[0] != null ? String(watchlist.sourceContributions[0].scoreSharePercent) : "",
        escapeField(summarizeSegments(watchlist.audienceSummary, "audience")),
        escapeField(summarizeSegments(watchlist.audienceSummary, "market")),
        escapeField(summarizeSegments(watchlist.audienceSummary, "language")),
        escapeField(summarizeGeoLabels(watchlist.geoSummary)),
        watchlist.shareToken,
        watchlist.expiresAt ?? "",
        watchlist.createdAt,
        watchlist.updatedAt,
      ].join(","),
    );
  }
  return rows.join("\n") + "\n";
}
