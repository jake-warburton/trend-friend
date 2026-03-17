import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";
import { mutateWatchlists, WatchlistServiceError } from "@/lib/server/watchlist-service";

type RouteContext = {
  params: Promise<{ watchlistId: string; shareId: string }>;
};

type AttributionRouteDependencies = {
  mutateWatchlists: typeof mutateWatchlists;
};

export async function handleShareAttributionPost(
  request: Request,
  context: RouteContext,
  dependencies: AttributionRouteDependencies = { mutateWatchlists },
) {
  try {
    const body = (await request.json()) as { showCreator?: boolean };
    const { watchlistId, shareId } = await context.params;
    const payload = await dependencies.mutateWatchlists(
      {
        action: "set-share-attribution",
        watchlistId: Number(watchlistId),
        shareId: Number(shareId),
        showCreator: body.showCreator === true,
      },
      {
        apiHeaders: await buildForwardedAuthHeaders(request),
      },
    );
    return NextResponse.json(payload);
  } catch (error) {
    const message = "Share attribution update failed";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  return handleShareAttributionPost(request, context);
}
