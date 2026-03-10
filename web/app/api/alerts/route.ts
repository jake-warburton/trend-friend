import { NextResponse } from "next/server";

import { listAlerts, mutateAlerts, type AlertMutationBody } from "@/lib/server/watchlist-service";

type AlertRouteDependencies = {
  listAlerts: typeof listAlerts;
  mutateAlerts: typeof mutateAlerts;
};

export async function handleAlertsGet(
  request: Request,
  dependencies: AlertRouteDependencies = { listAlerts, mutateAlerts },
) {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread_only") === "true";
    const payload = await dependencies.listAlerts(unreadOnly);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleAlertsGet(request);
}

export async function handleAlertsPost(
  request: Request,
  dependencies: AlertRouteDependencies = { listAlerts, mutateAlerts },
) {
  try {
    const body = (await request.json()) as AlertMutationBody;
    const payload = await dependencies.mutateAlerts(body);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleAlertsPost(request);
}
