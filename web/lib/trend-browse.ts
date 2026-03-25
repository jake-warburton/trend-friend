import { formatCategoryLabel } from "@/lib/category-labels";
import type { TrendDetailRecord, TrendExplorerRecord } from "@/lib/types";

export type TrendBrowseRecord = Pick<
  TrendExplorerRecord,
  | "id"
  | "name"
  | "category"
  | "metaTrend"
  | "stage"
  | "confidence"
  | "summary"
  | "status"
  | "rank"
  | "score"
>;

export type MetaTrendDirectoryItem = {
  slug: string;
  label: string;
  trendCount: number;
  averageScore: number;
  topTrendId: string;
  topTrendName: string;
  categories: string[];
};

export type CategoryDirectoryItem = {
  slug: string;
  label: string;
  metaTrend: string;
  trendCount: number;
  averageScore: number;
  topTrendId: string;
  topTrendName: string;
};

export type TrendBrowseGroup = {
  slug: string;
  label: string;
  description: string;
  averageScore: number;
  trendCount: number;
  topTrendId: string;
  topTrendName: string;
  trends: TrendBrowseRecord[];
};

export function buildMetaTrendDirectory(
  trends: TrendBrowseRecord[],
): MetaTrendDirectoryItem[] {
  const groups = new Map<string, TrendBrowseRecord[]>();
  for (const trend of trends) {
    groups.set(trend.metaTrend, [...(groups.get(trend.metaTrend) ?? []), trend]);
  }
  return Array.from(groups.entries())
    .map(([label, items]) => {
      const sorted = sortByRank(items);
      return {
        slug: slugifyBrowseValue(label),
        label,
        trendCount: items.length,
        averageScore: averageScore(items),
        topTrendId: sorted[0]?.id ?? "",
        topTrendName: sorted[0]?.name ?? label,
        categories: Array.from(new Set(items.map((item) => item.category))).sort(),
      };
    })
    .sort((left, right) => right.averageScore - left.averageScore || right.trendCount - left.trendCount || left.label.localeCompare(right.label));
}

export function buildCategoryDirectory(
  trends: TrendBrowseRecord[],
): CategoryDirectoryItem[] {
  const groups = new Map<string, TrendBrowseRecord[]>();
  for (const trend of trends) {
    groups.set(trend.category, [...(groups.get(trend.category) ?? []), trend]);
  }
  return Array.from(groups.entries())
    .map(([category, items]) => {
      const sorted = sortByRank(items);
      return {
        slug: category,
        label: formatCategoryLabel(category),
        metaTrend: sorted[0]?.metaTrend ?? "General",
        trendCount: items.length,
        averageScore: averageScore(items),
        topTrendId: sorted[0]?.id ?? "",
        topTrendName: sorted[0]?.name ?? formatCategoryLabel(category),
      };
    })
    .sort((left, right) => right.averageScore - left.averageScore || right.trendCount - left.trendCount || left.label.localeCompare(right.label));
}

export function findMetaTrendGroup(
  trends: TrendBrowseRecord[],
  slug: string,
): TrendBrowseGroup | null {
  const normalizedSlug = slugifyBrowseValue(slug);
  const label = buildMetaTrendDirectory(trends).find((item) => item.slug === normalizedSlug)?.label;
  if (!label) {
    return null;
  }
  const items = sortByRank(trends.filter((trend) => slugifyBrowseValue(trend.metaTrend) === normalizedSlug));
  return {
    slug: normalizedSlug,
    label,
    description: `${label} groups related demand shifts that share similar buyer and builder intent.`,
    averageScore: averageScore(items),
    trendCount: items.length,
    topTrendId: items[0]?.id ?? "",
    topTrendName: items[0]?.name ?? label,
    trends: items,
  };
}

export function findCategoryGroup(
  trends: TrendBrowseRecord[],
  slug: string,
): TrendBrowseGroup | null {
  const normalizedSlug = slugifyBrowseValue(slug);
  const items = sortByRank(trends.filter((trend) => trend.category === normalizedSlug));
  if (items.length === 0) {
    return null;
  }
  return {
    slug: normalizedSlug,
    label: formatCategoryLabel(normalizedSlug),
    description: `${formatCategoryLabel(normalizedSlug)} trends are clustered by the pipeline into one working category.`,
    averageScore: averageScore(items),
    trendCount: items.length,
    topTrendId: items[0]?.id ?? "",
    topTrendName: items[0]?.name ?? formatCategoryLabel(normalizedSlug),
    trends: items,
  };
}

export function buildComparisonSuggestions(
  selectedIds: string[],
  trends: TrendDetailRecord[],
  candidateTrends: TrendBrowseRecord[] = trends,
  limit = 4,
): TrendBrowseRecord[] {
  const selected = trends.filter((trend) => selectedIds.includes(trend.id));
  const selectedIdSet = new Set(selected.map((trend) => trend.id));
  if (selected.length === 0) {
    return sortByRank(candidateTrends).slice(0, limit);
  }

  const candidateIds: string[] = [];
  for (const trend of selected) {
    for (const duplicate of trend.duplicateCandidates) {
      if (!selectedIdSet.has(duplicate.id)) {
        candidateIds.push(duplicate.id);
      }
    }
    for (const related of trend.relatedTrends) {
      if (!selectedIdSet.has(related.id)) {
        candidateIds.push(related.id);
      }
    }
    for (const peer of candidateTrends) {
      if (!selectedIdSet.has(peer.id) && peer.metaTrend === trend.metaTrend) {
        candidateIds.push(peer.id);
      }
    }
  }

  const uniqueCandidates = Array.from(new Set(candidateIds));
  return sortByRank(
    candidateTrends.filter((trend) => uniqueCandidates.includes(trend.id)),
  ).slice(0, limit);
}

export function slugifyBrowseValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "browse";
}

function averageScore(trends: TrendBrowseRecord[]): number {
  if (trends.length === 0) {
    return 0;
  }
  return Number((trends.reduce((total, trend) => total + trend.score.total, 0) / trends.length).toFixed(1));
}

function sortByRank<T extends TrendBrowseRecord>(trends: T[]): T[] {
  return [...trends].sort((left, right) => left.rank - right.rank || right.score.total - left.score.total || left.name.localeCompare(right.name));
}
