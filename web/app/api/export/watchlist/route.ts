import { NextResponse, type NextRequest } from "next/server";

import { requirePro } from "@/lib/server/require-pro";
import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";
import { listWatchlists } from "@/lib/server/watchlist-service";
import { loadTrendExplorer } from "@/lib/trends";
import type { TrendExplorerRecord, Watchlist, WatchlistResponse } from "@/lib/types";

const CSV_COLUMNS = [
  "rank",
  "name",
  "category",
  "status",
  "volatility",
  "score",
  "social_score",
  "developer_score",
  "knowledge_score",
  "search_score",
  "diversity_score",
  "rank_change",
  "momentum_pct",
  "source_count",
  "signal_count",
  "sources",
  "audience_segments",
  "market_segments",
  "language_segments",
  "forecast_direction",
  "first_seen",
  "latest_signal",
  "added_at",
];

function escapeField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function trendToWatchlistCsvRow(trend: TrendExplorerRecord, addedAt: string): string {
  const audienceSummary = trend.audienceSummary ?? [];
  const fields = [
    String(trend.rank),
    escapeField(trend.name),
    escapeField(trend.category),
    trend.status,
    trend.volatility,
    String(trend.score.total),
    String(trend.score.social),
    String(trend.score.developer),
    String(trend.score.knowledge),
    String(trend.score.search),
    String(trend.score.diversity),
    trend.rankChange != null ? String(trend.rankChange) : "",
    trend.momentum.percentDelta != null ? String(trend.momentum.percentDelta) : "",
    String(trend.coverage.sourceCount),
    String(trend.coverage.signalCount),
    escapeField(trend.sources.join(",")),
    escapeField(summarizeSegments(audienceSummary, "audience")),
    escapeField(summarizeSegments(audienceSummary, "market")),
    escapeField(summarizeSegments(audienceSummary, "language")),
    trend.forecastDirection ?? "",
    trend.firstSeenAt ?? "",
    trend.latestSignalAt,
    addedAt,
  ];
  return fields.join(",");
}

function summarizeSegments(summary: NonNullable<TrendExplorerRecord["audienceSummary"]>, segmentType: string): string {
  return summary
    .filter((item) => item.segmentType === segmentType)
    .map((item) => item.label)
    .join(",");
}

export function buildWatchlistCsv(
  watchlist: Watchlist,
  trends: TrendExplorerRecord[],
): string {
  const trendById = new Map(trends.map((t) => [t.id, t]));
  const addedAtById = new Map(watchlist.items.map((item) => [item.trendId, item.addedAt]));

  const rows = [CSV_COLUMNS.join(",")];
  for (const item of watchlist.items) {
    const trend = trendById.get(item.trendId);
    if (trend) {
      rows.push(trendToWatchlistCsvRow(trend, addedAtById.get(item.trendId) ?? ""));
    }
  }

  return rows.join("\n") + "\n";
}

export async function GET(request: NextRequest) {
  const check = await requirePro();
  if (!check.authorized) return check.response;

  const idParam = request.nextUrl.searchParams.get("id");
  if (!idParam) {
    return NextResponse.json({ error: "Missing watchlist id" }, { status: 400 });
  }
  const watchlistId = Number(idParam);
  if (Number.isNaN(watchlistId)) {
    return NextResponse.json({ error: "Invalid watchlist id" }, { status: 400 });
  }

  let watchlist: Watchlist | undefined;
  try {
    const data = (await listWatchlists({
      apiHeaders: await buildForwardedAuthHeaders(request),
    })) as WatchlistResponse;
    watchlist = data.watchlists.find((w) => w.id === watchlistId);
  } catch {
    return NextResponse.json({ error: "Could not load watchlists" }, { status: 500 });
  }

  if (!watchlist) {
    return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
  }

  const explorer = await loadTrendExplorer();
  const csv = buildWatchlistCsv(watchlist, explorer.trends);
  const date = new Date().toISOString().slice(0, 10);
  const safeName = watchlist.name.replace(/[^a-zA-Z0-9_-]/g, "-");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="watchlist-${safeName}-${date}.csv"`,
    },
  });
}
