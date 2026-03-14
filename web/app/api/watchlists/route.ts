import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";
import { listWatchlists, mutateWatchlists, WatchlistServiceError, type WatchlistMutationBody } from "@/lib/server/watchlist-service";

type WatchlistRouteDependencies = {
  listWatchlists: typeof listWatchlists;
  mutateWatchlists: typeof mutateWatchlists;
};

export async function handleWatchlistsGet(
  request?: Request,
  dependencies: WatchlistRouteDependencies = { listWatchlists, mutateWatchlists },
) {
  try {
    const payload = await dependencies.listWatchlists({
      apiHeaders: request ? await buildForwardedAuthHeaders(request) : undefined,
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watchlist request failed";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  return handleWatchlistsGet(request);
}

export async function handleWatchlistsPost(
  request: Request,
  dependencies: WatchlistRouteDependencies = { listWatchlists, mutateWatchlists },
) {
  try {
    const body = (await request.json()) as WatchlistMutationBody;
    const payload = await dependencies.mutateWatchlists(body, {
      apiHeaders: await buildForwardedAuthHeaders(request),
    });
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watchlist request failed";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  return handleWatchlistsPost(request);
}
