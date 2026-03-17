import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getRefreshErrorStatus, refreshData } from "@/lib/server/refresh-service";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
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
