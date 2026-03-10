import { NextResponse } from "next/server";

import { apiGet, apiPost, ApiError } from "@/lib/api-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread_only") === "true";
    const path = unreadOnly ? "/alerts?unread_only=true" : "/alerts";
    const payload = await apiGet<object>(path);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert request failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Route to different endpoints based on action
    if (body.action === "mark-read") {
      const payload = await apiPost<object>("/alerts/read", { eventIds: body.eventIds });
      return NextResponse.json(payload);
    }

    // Default: create alert rule
    const payload = await apiPost<object>("/alerts/rules", body);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert request failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
