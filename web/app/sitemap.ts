import type { MetadataRoute } from "next";
import { loadTrendExplorer } from "@/lib/trends";
import { slugifyBrowseValue } from "@/lib/trend-browse";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

// Use start-of-day as lastModified so crawlers don't think content changed on every request
function todayDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = todayDate();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1.0, lastModified: today },
    { url: `${BASE_URL}/explore`, changeFrequency: "weekly", priority: 0.9, lastModified: today },
    { url: `${BASE_URL}/pricing`, changeFrequency: "monthly", priority: 0.6, lastModified: today },
    { url: `${BASE_URL}/social-intelligence`, changeFrequency: "weekly", priority: 0.7, lastModified: today },
    { url: `${BASE_URL}/ad-intelligence`, changeFrequency: "weekly", priority: 0.7, lastModified: today },
  ];

  let trendPages: MetadataRoute.Sitemap = [];
  let categoryPages: MetadataRoute.Sitemap = [];
  let metaTrendPages: MetadataRoute.Sitemap = [];
  let sourcePages: MetadataRoute.Sitemap = [];

  try {
    const explorer = await loadTrendExplorer();

    trendPages = explorer.trends.map((trend) => ({
      url: `${BASE_URL}/trends/${trend.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      lastModified: today,
    }));

    const uniqueCategories = Array.from(
      new Set(explorer.trends.map((t) => t.category).filter(Boolean)),
    );
    categoryPages = [
      { url: `${BASE_URL}/categories/`, changeFrequency: "weekly" as const, priority: 0.8, lastModified: today },
      ...uniqueCategories.map((category) => ({
        url: `${BASE_URL}/categories/${slugifyBrowseValue(category)}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        lastModified: today,
      })),
    ];

    const uniqueMetaTrends = Array.from(
      new Set(explorer.trends.map((t) => t.metaTrend).filter(Boolean)),
    );
    metaTrendPages = [
      { url: `${BASE_URL}/meta-trends/`, changeFrequency: "weekly" as const, priority: 0.8, lastModified: today },
      ...uniqueMetaTrends.map((metaTrend) => ({
        url: `${BASE_URL}/meta-trends/${slugifyBrowseValue(metaTrend)}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        lastModified: today,
      })),
    ];

    const uniqueSources = Array.from(
      new Set(explorer.trends.flatMap((t) => t.sources).filter(Boolean)),
    );
    sourcePages = uniqueSources.map((source) => ({
      url: `${BASE_URL}/sources/${source}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      lastModified: today,
    }));
  } catch {
    // If data loading fails, return static pages only
  }

  return [...staticPages, ...trendPages, ...categoryPages, ...metaTrendPages, ...sourcePages];
}
