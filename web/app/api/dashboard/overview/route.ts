import { NextResponse } from "next/server";

import { loadDashboardOverview } from "@/lib/trends";

export const revalidate = 2400;

export async function GET() {
  const overview = await loadDashboardOverview();
  return NextResponse.json(overview);
}
