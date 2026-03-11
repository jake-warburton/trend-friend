import { NextResponse } from "next/server";

import { loadTrendExplorer } from "@/lib/trends";
import type { TrendExplorerRecord } from "@/lib/types";

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
];

function escapeField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function trendToCsvRow(trend: TrendExplorerRecord): string {
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
  ];
  return fields.join(",");
}

function summarizeSegments(summary: NonNullable<TrendExplorerRecord["audienceSummary"]>, segmentType: string): string {
  return summary
    .filter((item) => item.segmentType === segmentType)
    .map((item) => item.label)
    .join(",");
}

export async function GET() {
  const explorer = await loadTrendExplorer();
  const rows = [CSV_COLUMNS.join(","), ...explorer.trends.map(trendToCsvRow)];
  const csv = rows.join("\n") + "\n";
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="signal-eye-export-${date}.csv"`,
    },
  });
}
