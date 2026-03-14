import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";
import { listAlerts, mutateAlerts, WatchlistServiceError, type AlertMutationBody } from "@/lib/server/watchlist-service";

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
    const payload = await dependencies.listAlerts(unreadOnly, {
      apiHeaders: await buildForwardedAuthHeaders(request),
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert request failed";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
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
    const payload = await dependencies.mutateAlerts(body, {
      apiHeaders: await buildForwardedAuthHeaders(request),
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert request failed";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  return handleAlertsPost(request);
}
