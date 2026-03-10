import { NextResponse } from "next/server";

import { loadTrendExplorer } from "@/lib/trends";
import type { TrendExplorerRecord } from "@/lib/types";

const CSV_COLUMNS = [
  "rank",
  "name",
  "category",
  "status",
  "score",
  "social_score",
  "developer_score",
  "knowledge_score",
  "search_score",
  "diversity_score",
  "rank_change",
  "sources",
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
  const fields = [
    String(trend.rank),
    escapeField(trend.name),
    escapeField(trend.category),
    trend.status,
    String(trend.score.total),
    String(trend.score.social),
    String(trend.score.developer),
    String(trend.score.knowledge),
    String(trend.score.search),
    String(trend.score.diversity),
    trend.rankChange != null ? String(trend.rankChange) : "",
    escapeField(trend.sources.join(",")),
    trend.firstSeenAt ?? "",
    trend.latestSignalAt,
  ];
  return fields.join(",");
}

export async function GET() {
  const explorer = await loadTrendExplorer();
  const rows = [CSV_COLUMNS.join(","), ...explorer.trends.map(trendToCsvRow)];
  const csv = rows.join("\n") + "\n";
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="trend-friend-export-${date}.csv"`,
    },
  });
}
