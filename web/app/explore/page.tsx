import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { loadExploreInitialData } from "@/lib/trends";

export const metadata: Metadata = {
  title: "Explore Emerging Trends",
  description:
    "Browse and filter 1,000+ emerging trends ranked by momentum across 24 data sources. Discover breakout topics in tech, culture, health, finance, and more — updated daily.",
  keywords: [
    "explore trends",
    "emerging trends",
    "trending topics",
    "breakout trends",
    "trend explorer",
    "rising trends",
    "trend rankings",
    "trend momentum",
    "market trends",
    "tech trends",
  ],
  openGraph: {
    title: "Explore Emerging Trends — Signal Eye",
    description:
      "Browse and filter 1,000+ emerging trends ranked by momentum across 24 data sources. Updated daily.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore Emerging Trends — Signal Eye",
    description:
      "Browse and filter 1,000+ emerging trends ranked by momentum across 24 data sources.",
  },
};

export const dynamic = "force-static";
export const revalidate = 300;

export default async function Page() {
  const initialData = await loadExploreInitialData();
  return <DashboardShell initialData={initialData} />;
}
