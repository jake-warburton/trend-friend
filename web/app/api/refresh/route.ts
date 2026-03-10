import { NextResponse } from "next/server";

import { getRefreshErrorStatus, refreshData } from "@/lib/server/refresh-service";

export async function POST() {
  try {
    const payload = await refreshData();
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed";
    return NextResponse.json({ ok: false, error: message }, { status: getRefreshErrorStatus(error) });
  }
}
