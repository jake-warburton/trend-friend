import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { listPublicWatchlists, WatchlistServiceError } from "@/lib/server/watchlist-service";

export async function GET() {
  try {
    const payload = await listPublicWatchlists();
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "s-maxage=2400, stale-while-revalidate=600" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Community watchlists unavailable";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
