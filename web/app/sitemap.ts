import type { MetadataRoute } from "next";
import { loadTrendExplorer } from "@/lib/trends";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.signaleye.live";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/explore`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/pricing`, changeFrequency: "weekly", priority: 0.6 },
  ];

  let trendPages: MetadataRoute.Sitemap = [];
  try {
    const explorer = await loadTrendExplorer();
    trendPages = explorer.trends.map((trend) => ({
      url: `${BASE_URL}/trends/${trend.id}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
  } catch {
    // If data loading fails, return static pages only
  }

  return [...staticPages, ...trendPages];
}
