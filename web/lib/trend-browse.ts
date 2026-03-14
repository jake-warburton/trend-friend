import { formatCategoryLabel } from "@/lib/category-labels";
import type { TrendDetailRecord } from "@/lib/types";

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
  trends: TrendDetailRecord[];
};

export function buildMetaTrendDirectory(trends: TrendDetailRecord[]): MetaTrendDirectoryItem[] {
  const groups = new Map<string, TrendDetailRecord[]>();
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

export function buildCategoryDirectory(trends: TrendDetailRecord[]): CategoryDirectoryItem[] {
  const groups = new Map<string, TrendDetailRecord[]>();
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

export function findMetaTrendGroup(trends: TrendDetailRecord[], slug: string): TrendBrowseGroup | null {
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

export function findCategoryGroup(trends: TrendDetailRecord[], slug: string): TrendBrowseGroup | null {
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
  limit = 4,
): TrendDetailRecord[] {
  const selected = trends.filter((trend) => selectedIds.includes(trend.id));
  const selectedIdSet = new Set(selected.map((trend) => trend.id));
  if (selected.length === 0) {
    return sortByRank(trends).slice(0, limit);
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
    for (const peer of trends) {
      if (!selectedIdSet.has(peer.id) && peer.metaTrend === trend.metaTrend) {
        candidateIds.push(peer.id);
      }
    }
  }

  const uniqueCandidates = Array.from(new Set(candidateIds));
  return sortByRank(trends.filter((trend) => uniqueCandidates.includes(trend.id))).slice(0, limit);
}

export function slugifyBrowseValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "browse";
}

function averageScore(trends: TrendDetailRecord[]): number {
  if (trends.length === 0) {
    return 0;
  }
  return Number((trends.reduce((total, trend) => total + trend.score.total, 0) / trends.length).toFixed(1));
}

function sortByRank(trends: TrendDetailRecord[]): TrendDetailRecord[] {
  return [...trends].sort((left, right) => left.rank - right.rank || right.score.total - left.score.total || left.name.localeCompare(right.name));
}
