import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { buildSharedWatchlistCsv } from "@/lib/share-csv";
import { WatchlistServiceError, getSharedWatchlist } from "@/lib/server/watchlist-service";

type RouteContext = {
  params: Promise<{ token: string }>;
};

type SharedExportDependencies = {
  getSharedWatchlist: typeof getSharedWatchlist;
};

export async function handleSharedExportGet(
  request: Request,
  context: RouteContext,
  dependencies: SharedExportDependencies = { getSharedWatchlist },
) {
  try {
    const { token } = await context.params;
    const payload = await dependencies.getSharedWatchlist(token);
    const csv = buildSharedWatchlistCsv(payload as never);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="shared-watchlist-${token}-${date}.csv"`,
      },
    });
  } catch (error) {
    const message = "Shared watchlist unavailable";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request, context: RouteContext) {
  return handleSharedExportGet(request, context);
}
