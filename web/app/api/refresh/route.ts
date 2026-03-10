import { NextResponse } from "next/server";

import { apiPost, ApiError } from "@/lib/api-client";

export async function POST() {
  try {
    const payload = await apiPost<object>("/refresh", {});
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
