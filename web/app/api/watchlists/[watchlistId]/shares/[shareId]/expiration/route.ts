import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";
import { mutateWatchlists, WatchlistServiceError } from "@/lib/server/watchlist-service";

type RouteContext = {
  params: Promise<{ watchlistId: string; shareId: string }>;
};

type ExpirationRouteDependencies = {
  mutateWatchlists: typeof mutateWatchlists;
};

export async function handleShareExpirationPost(
  request: Request,
  context: RouteContext,
  dependencies: ExpirationRouteDependencies = { mutateWatchlists },
) {
  try {
    const body = (await request.json()) as { expiresAt?: string | null };
    const { watchlistId, shareId } = await context.params;
    const payload = await dependencies.mutateWatchlists(
      {
        action: "set-share-expiration",
        watchlistId: Number(watchlistId),
        shareId: Number(shareId),
        expiresAt: body.expiresAt ?? null,
      },
      {
        apiHeaders: await buildForwardedAuthHeaders(request),
      },
    );
    return NextResponse.json(payload);
  } catch (error) {
    const message = "Share expiration update failed";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  return handleShareExpirationPost(request, context);
}
