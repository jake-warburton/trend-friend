import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";
import { mutateWatchlists, WatchlistServiceError } from "@/lib/server/watchlist-service";

type RouteContext = {
  params: Promise<{ watchlistId: string }>;
};

type ShareDefaultsRouteDependencies = {
  mutateWatchlists: typeof mutateWatchlists;
};

export async function handleShareDefaultsPost(
  request: Request,
  context: RouteContext,
  dependencies: ShareDefaultsRouteDependencies = { mutateWatchlists },
) {
  try {
    const body = (await request.json()) as { defaultExpiryDays?: number | null };
    const { watchlistId } = await context.params;
    const payload = await dependencies.mutateWatchlists(
      {
        action: "set-share-default-expiry",
        watchlistId: Number(watchlistId),
        defaultExpiryDays: body.defaultExpiryDays ?? null,
      },
      {
        apiHeaders: buildForwardedAuthHeaders(request),
      },
    );
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Share defaults update failed";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  return handleShareDefaultsPost(request, context);
}
