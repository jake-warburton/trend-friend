import { NextResponse } from "next/server";

import {
  confidenceBucketForTrend,
  trendMatchesAudience,
  trendMatchesLanguage,
  trendMatchesMarket,
} from "@/lib/trend-filters";
import { trendMatchesGeo } from "@/lib/explorer-geo";
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

type ExportRouteDependencies = {
  loadTrendExplorer: typeof loadTrendExplorer;
  loadTrendDetails: typeof loadTrendDetails;
};

const DEFAULT_DEPENDENCIES: ExportRouteDependencies = {
  loadTrendExplorer,
  loadTrendDetails,
};

export async function handleExportGet(
  request: Request = new Request("http://localhost/api/export"),
  dependencies: ExportRouteDependencies = DEFAULT_DEPENDENCIES,
) {
  const { searchParams } = new URL(request.url);
  const [explorer, details] = await Promise.all([
    dependencies.loadTrendExplorer(),
    dependencies.loadTrendDetails(),
  ]);
  const detailsById = new Map(details.trends.map((trend) => [trend.id, trend]));

  const selectedSource = searchParams.get("source") ?? "all";
  const selectedCategory = searchParams.get("category") ?? "all";
  const selectedStage = searchParams.get("stage") ?? "all";
  const selectedConfidence = searchParams.get("confidence") ?? "all";
  const selectedLens = searchParams.get("lens") ?? "all";
  const selectedMetaTrend = searchParams.get("metaTrend") ?? "all";
  const selectedAudience = searchParams.get("audience") ?? "all";
  const selectedMarket = searchParams.get("market") ?? "all";
  const selectedLanguage = searchParams.get("language") ?? "all";
  const selectedGeoCountry = searchParams.get("geo") ?? "all";
  const selectedStatus = searchParams.get("status") ?? "all";
  const keyword = (searchParams.get("q") ?? "").trim().toLowerCase();
  const minimumScore = Number(searchParams.get("min") ?? "0");
  const hideRecurring = searchParams.get("hideRecurring") === "1";
  const sortBy = searchParams.get("sort") ?? "rank";
  const sortDirection = (searchParams.get("sortDir") === "asc" ? "asc" : "desc");

  const filteredTrends = explorer.trends.filter((trend) => {
    const detail = detailsById.get(trend.id);
    const matchesSource =
      selectedSource === "all" || trend.sources.includes(selectedSource);
    const matchesCategory =
      selectedCategory === "all" || trend.category === selectedCategory;
    const matchesStage =
      selectedStage === "all" || trend.stage === selectedStage;
    const matchesConfidence =
      selectedConfidence === "all" ||
      confidenceBucketForTrend(trend.confidence) === selectedConfidence;
    const matchesMetaTrend =
      selectedMetaTrend === "all" || trend.metaTrend === selectedMetaTrend;
    const matchesAudience = trendMatchesAudience(detail, selectedAudience);
    const matchesMarket = trendMatchesMarket(detail, selectedMarket);
    const matchesLanguage = trendMatchesLanguage(detail, selectedLanguage);
    const matchesGeo = trendMatchesGeo(detail, selectedGeoCountry);
    const matchesKeyword =
      keyword.length === 0 ||
      trend.name.toLowerCase().includes(keyword) ||
      trend.evidencePreview.some((item) =>
        item.toLowerCase().includes(keyword),
      );
    const matchesScore = trend.score.total >= minimumScore;
    const matchesSeasonality =
      !hideRecurring || !isRecurringTrend(trend.seasonality);
    const matchesStatus =
      selectedStatus === "all" || trend.status === selectedStatus;

    return (
      matchesSource &&
      matchesCategory &&
      matchesStage &&
      matchesConfidence &&
      matchesMetaTrend &&
      matchesAudience &&
      matchesMarket &&
      matchesLanguage &&
      matchesGeo &&
      matchesKeyword &&
      matchesScore &&
      matchesSeasonality &&
      matchesStatus
    );
  });

  const dir = sortDirection === "asc" ? 1 : -1;
  const trends = [...filteredTrends].sort((left, right) => {
    const leftDetail = detailsById.get(left.id);
    const rightDetail = detailsById.get(right.id);

    if (selectedLens !== "all") {
      const lensDelta =
        getOpportunityScore(rightDetail, selectedLens) -
        getOpportunityScore(leftDetail, selectedLens);
      if (lensDelta !== 0) {
        return lensDelta;
      }
    }

    if (sortBy === "strength") {
      return dir * (left.score.total - right.score.total) || left.rank - right.rank;
    }
    if (sortBy === "dateAdded") {
      return dir * compareDates(left.firstSeenAt, right.firstSeenAt) || left.rank - right.rank;
    }
    if (sortBy === "latestActivity") {
      return dir * compareDates(left.latestSignalAt, right.latestSignalAt) || left.rank - right.rank;
    }
    if (sortBy === "sources") {
      return (
        dir * (left.coverage.sourceCount - right.coverage.sourceCount) ||
        left.rank - right.rank
      );
    }
    if (sortBy === "momentum") {
      return (
        dir *
          ((left.momentum.absoluteDelta ?? 0) -
            (right.momentum.absoluteDelta ?? 0)) ||
        left.rank - right.rank
      );
    }
    return dir * (left.rank - right.rank);
  });

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

export async function GET(request: Request = new Request("http://localhost/api/export")) {
  return handleExportGet(request);
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

function compareDates(left: string | null, right: string | null) {
  const leftTime = left ? new Date(left).getTime() : Number.NEGATIVE_INFINITY;
  const rightTime = right ? new Date(right).getTime() : Number.NEGATIVE_INFINITY;
  return leftTime - rightTime;
}
