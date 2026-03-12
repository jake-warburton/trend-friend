import { DashboardShell } from "@/components/dashboard-shell";
import { loadDashboardData } from "@/lib/trends";

export const dynamic = "force-dynamic";

export default async function Page() {
  const dashboardData = await loadDashboardData();
  const canManualRefresh = !!process.env.SIGNAL_EYE_API_URL || !process.env.VERCEL;
  return <DashboardShell initialData={dashboardData} canManualRefresh={canManualRefresh} />;
}
