import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { loadExploreInitialData } from "@/lib/trends";

export const metadata: Metadata = {
  title: "Explore Trends | Signal Eye",
  description:
    "Browse emerging trends, ranked momentum, and recent signals across the Signal Eye explorer.",
};

export const dynamic = "force-static";
export const revalidate = 300;

export default async function Page() {
  const initialData = await loadExploreInitialData();
  const canManualRefresh = !!process.env.SIGNAL_EYE_API_URL || !process.env.VERCEL;
  return <DashboardShell initialData={initialData} canManualRefresh={canManualRefresh} />;
}
