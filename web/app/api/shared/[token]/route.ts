import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { WatchlistServiceError, getSharedWatchlist } from "@/lib/server/watchlist-service";

type RouteContext = {
  params: Promise<{ token: string }>;
};

type SharedRouteDependencies = {
  getSharedWatchlist: typeof getSharedWatchlist;
};

export async function handleSharedWatchlistGet(
  request: Request,
  context: RouteContext,
  dependencies: SharedRouteDependencies = { getSharedWatchlist },
) {
  try {
    const { token } = await context.params;
    const payload = await dependencies.getSharedWatchlist(token);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shared watchlist unavailable";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request, context: RouteContext) {
  return handleSharedWatchlistGet(request, context);
}
