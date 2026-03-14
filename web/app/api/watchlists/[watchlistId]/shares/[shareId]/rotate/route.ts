import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";
import { mutateWatchlists, WatchlistServiceError } from "@/lib/server/watchlist-service";

type RouteContext = {
  params: Promise<{ watchlistId: string; shareId: string }>;
};

type RotateRouteDependencies = {
  mutateWatchlists: typeof mutateWatchlists;
};

export async function handleRotateSharePost(
  request: Request,
  context: RouteContext,
  dependencies: RotateRouteDependencies = { mutateWatchlists },
) {
  try {
    const { watchlistId, shareId } = await context.params;
    const payload = await dependencies.mutateWatchlists(
      {
        action: "rotate-share",
        watchlistId: Number(watchlistId),
        shareId: Number(shareId),
      },
      {
        apiHeaders: await buildForwardedAuthHeaders(request),
      },
    );
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Share rotation failed";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  return handleRotateSharePost(request, context);
}
