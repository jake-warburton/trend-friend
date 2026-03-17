import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getRefreshErrorStatus, refreshData } from "@/lib/server/refresh-service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await refreshData();
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    const message = "Refresh failed";
    return NextResponse.json({ ok: false, error: message }, { status: getRefreshErrorStatus(error) });
  }
}
