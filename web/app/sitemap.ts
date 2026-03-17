import type { MetadataRoute } from "next";
import { loadTrendExplorer } from "@/lib/trends";
import { slugifyBrowseValue } from "@/lib/trend-browse";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1.0, lastModified: new Date() },
    { url: `${BASE_URL}/explore`, changeFrequency: "hourly", priority: 0.9, lastModified: new Date() },
    { url: `${BASE_URL}/pricing`, changeFrequency: "weekly", priority: 0.6, lastModified: new Date() },
    { url: `${BASE_URL}/social-intelligence`, changeFrequency: "daily", priority: 0.7, lastModified: new Date() },
    { url: `${BASE_URL}/ad-intelligence`, changeFrequency: "daily", priority: 0.7, lastModified: new Date() },
  ];

  let trendPages: MetadataRoute.Sitemap = [];
  let categoryPages: MetadataRoute.Sitemap = [];
  let metaTrendPages: MetadataRoute.Sitemap = [];
  let sourcePages: MetadataRoute.Sitemap = [];

  try {
    const explorer = await loadTrendExplorer();

    trendPages = explorer.trends.map((trend) => ({
      url: `${BASE_URL}/trends/${trend.id}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
      lastModified: new Date(),
    }));

    const uniqueCategories = Array.from(
      new Set(explorer.trends.map((t) => t.category).filter(Boolean)),
    );
    categoryPages = [
      { url: `${BASE_URL}/categories/`, changeFrequency: "daily" as const, priority: 0.8, lastModified: new Date() },
      ...uniqueCategories.map((category) => ({
        url: `${BASE_URL}/categories/${slugifyBrowseValue(category)}`,
        changeFrequency: "daily" as const,
        priority: 0.8,
        lastModified: new Date(),
      })),
    ];

    const uniqueMetaTrends = Array.from(
      new Set(explorer.trends.map((t) => t.metaTrend).filter(Boolean)),
    );
    metaTrendPages = [
      { url: `${BASE_URL}/meta-trends/`, changeFrequency: "daily" as const, priority: 0.8, lastModified: new Date() },
      ...uniqueMetaTrends.map((metaTrend) => ({
        url: `${BASE_URL}/meta-trends/${slugifyBrowseValue(metaTrend)}`,
        changeFrequency: "daily" as const,
        priority: 0.8,
        lastModified: new Date(),
      })),
    ];

    const uniqueSources = Array.from(
      new Set(explorer.trends.flatMap((t) => t.sources).filter(Boolean)),
    );
    sourcePages = uniqueSources.map((source) => ({
      url: `${BASE_URL}/sources/${source}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
      lastModified: new Date(),
    }));
  } catch {
    // If data loading fails, return static pages only
  }

  return [...staticPages, ...trendPages, ...categoryPages, ...metaTrendPages, ...sourcePages];
}
