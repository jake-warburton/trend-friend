import { DashboardShell } from "@/components/dashboard-shell";
import { loadDashboardData } from "@/lib/trends";

export const dynamic = "force-dynamic";

export default async function Page() {
  const dashboardData = await loadDashboardData();
  return <DashboardShell initialData={dashboardData} />;
}
