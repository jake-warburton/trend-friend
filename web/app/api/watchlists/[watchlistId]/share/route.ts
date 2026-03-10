import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { WatchlistServiceError, shareWatchlist } from "@/lib/server/watchlist-service";

type RouteContext = {
  params: Promise<{ watchlistId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = (await request.json()) as { public?: boolean };
    const { watchlistId } = await context.params;
    const payload = await shareWatchlist(Number(watchlistId), body.public === true);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Share request failed";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
