import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { WatchlistServiceError, getSharedWatchlist } from "@/lib/server/watchlist-service";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const payload = await getSharedWatchlist(token);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shared watchlist unavailable";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
