import { NextResponse } from "next/server";

import { apiPost, ApiError } from "@/lib/api-client";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      watchlistId: number;
      name: string;
      ruleType: string;
      threshold: number;
    };
    const payload = await apiPost<object>("/alerts/rules", body);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert request failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
