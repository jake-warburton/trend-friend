import { NextResponse } from "next/server";

import { loadTrendDetails, loadTrendExplorer } from "@/lib/trends";
import { isRecurringTrend } from "@/lib/seasonality-ui";
import type { TrendDetailRecord, TrendExplorerRecord } from "@/lib/types";

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
  "discovery_score",
  "seo_score",
  "content_score",
  "product_score",
  "investment_score",
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

function trendToCsvRow(trend: TrendExplorerRecord, detail?: TrendDetailRecord): string {
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
    String(detail?.opportunity.discovery ?? 0),
    String(detail?.opportunity.seo ?? 0),
    String(detail?.opportunity.content ?? 0),
    String(detail?.opportunity.product ?? 0),
    String(detail?.opportunity.investment ?? 0),
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

export async function GET(request: Request = new Request("http://localhost/api/export")) {
  const { searchParams } = new URL(request.url);
  const [explorer, details] = await Promise.all([loadTrendExplorer(), loadTrendDetails()]);
  const detailsById = new Map(details.trends.map((trend) => [trend.id, trend]));

  let trends = explorer.trends;

  // Apply filters from query parameters
  const source = searchParams.get("source");
  if (source) {
    trends = trends.filter((t) => t.sources.includes(source));
  }

  const category = searchParams.get("category");
  if (category) {
    trends = trends.filter((t) => t.category === category);
  }

  const q = searchParams.get("q");
  if (q) {
    const normalizedQ = q.toLowerCase();
    trends = trends.filter(
      (t) =>
        t.name.toLowerCase().includes(normalizedQ) ||
        t.evidencePreview.some((item) => item.toLowerCase().includes(normalizedQ)),
    );
  }

  const min = searchParams.get("min");
  if (min) {
    const minScore = Number(min);
    trends = trends.filter((t) => t.score.total >= minScore);
  }

  const hideRecurring = searchParams.get("hideRecurring");
  if (hideRecurring === "1") {
    trends = trends.filter((t) => !isRecurringTrend(t.seasonality));
  }

  // Note: audience, market, language, and geo filters require trend detail data
  // which is not available at this level. These would need to be applied
  // at the data loading stage or require fetching detail records separately.
  // For now, only apply filters that work with explorer.trends data.

  // Sort trends
  const sortBy = searchParams.get("sort") || "rank";
  const lens = searchParams.get("lens") || "all";
  if (lens !== "all") {
    trends.sort(
      (left, right) =>
        getOpportunityScore(detailsById.get(right.id), lens) - getOpportunityScore(detailsById.get(left.id), lens) ||
        left.rank - right.rank,
    );
  } else if (sortBy === "score") {
    trends.sort((left, right) => right.score.total - left.score.total || left.rank - right.rank);
  } else if (sortBy === "mover") {
    trends.sort(
      (left, right) =>
        (right.rankChange ?? Number.NEGATIVE_INFINITY) - (left.rankChange ?? Number.NEGATIVE_INFINITY) ||
        left.rank - right.rank,
    );
  } else if (sortBy === "newest") {
    trends.sort((left, right) => {
      const leftDate = left.firstSeenAt ? new Date(left.firstSeenAt).getTime() : Number.NEGATIVE_INFINITY;
      const rightDate = right.firstSeenAt ? new Date(right.firstSeenAt).getTime() : Number.NEGATIVE_INFINITY;
      return rightDate - leftDate || left.rank - right.rank;
    });
  } else {
    trends.sort((left, right) => left.rank - right.rank);
  }

  const rows = [CSV_COLUMNS.join(","), ...trends.map((trend) => trendToCsvRow(trend, detailsById.get(trend.id)))];
  const csv = rows.join("\n") + "\n";
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="signal-eye-export-${date}.csv"`,
    },
  });
}

function getOpportunityScore(detail: TrendDetailRecord | undefined, lens: string) {
  if (!detail) {
    return 0;
  }
  if (lens === "discovery") {
    return detail.opportunity.discovery;
  }
  if (lens === "seo") {
    return detail.opportunity.seo;
  }
  if (lens === "content") {
    return detail.opportunity.content;
  }
  if (lens === "product") {
    return detail.opportunity.product;
  }
  if (lens === "investment") {
    return detail.opportunity.investment;
  }
  return detail.opportunity.composite;
}
