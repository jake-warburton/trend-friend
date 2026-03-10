import { NextResponse } from "next/server";

import { listWatchlists, mutateWatchlists, type WatchlistMutationBody } from "@/lib/server/watchlist-service";

type WatchlistRouteDependencies = {
  listWatchlists: typeof listWatchlists;
  mutateWatchlists: typeof mutateWatchlists;
};

export async function handleWatchlistsGet(
  _request?: Request,
  dependencies: WatchlistRouteDependencies = { listWatchlists, mutateWatchlists },
) {
  try {
    const payload = await dependencies.listWatchlists();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watchlist request failed";
    return NextResponse.json({ error: message }, { status: 500 });
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
    const payload = await dependencies.mutateWatchlists(body);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watchlist request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleWatchlistsPost(request);
}
