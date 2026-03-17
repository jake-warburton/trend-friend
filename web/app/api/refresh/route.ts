import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/require-pro";
import { getRefreshErrorStatus, refreshData } from "@/lib/server/refresh-service";

export async function POST() {
  const check = await requireAuth();
  if (!check.authorized) return check.response;

  try {
    const payload = await refreshData();
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    const message = "Refresh failed";
    return NextResponse.json({ ok: false, error: message }, { status: getRefreshErrorStatus(error) });
  }
}
