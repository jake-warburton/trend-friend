import { NextResponse } from "next/server";

import { listAlerts, mutateAlerts, type AlertMutationBody } from "@/lib/server/watchlist-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread_only") === "true";
    const payload = await listAlerts(unreadOnly);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AlertMutationBody;
    const payload = await mutateAlerts(body);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
