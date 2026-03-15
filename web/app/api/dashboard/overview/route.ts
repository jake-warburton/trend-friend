import { NextResponse } from "next/server";

import { loadDashboardOverview } from "@/lib/trends";

export async function GET() {
  const overview = await loadDashboardOverview();
  return NextResponse.json(overview, { headers: { "Cache-Control": "s-maxage=2400, stale-while-revalidate=600" } });
}
