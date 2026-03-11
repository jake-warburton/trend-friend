import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { buildCommunityWatchlistsCsv } from "@/lib/share-csv";
import { listPublicWatchlists, WatchlistServiceError } from "@/lib/server/watchlist-service";

type CommunityExportDependencies = {
  listPublicWatchlists: typeof listPublicWatchlists;
};

export async function handleCommunityExportGet(
  request: Request,
  dependencies: CommunityExportDependencies = { listPublicWatchlists },
) {
  try {
    const payload = await dependencies.listPublicWatchlists();
    const csv = buildCommunityWatchlistsCsv(payload as never);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="community-watchlists-${date}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Community watchlists unavailable";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  return handleCommunityExportGet(request);
}
