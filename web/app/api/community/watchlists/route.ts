import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { listPublicWatchlists, WatchlistServiceError } from "@/lib/server/watchlist-service";

export const revalidate = 172800;

export async function GET() {
  try {
    const payload = await listPublicWatchlists();
    return NextResponse.json(payload);
  } catch (error) {
    const message = "Community watchlists unavailable";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
