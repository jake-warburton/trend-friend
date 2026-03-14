import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";
import { mutateWatchlists, WatchlistServiceError } from "@/lib/server/watchlist-service";

type RouteContext = {
  params: Promise<{ watchlistId: string; shareId: string }>;
};

type VisibilityRouteDependencies = {
  mutateWatchlists: typeof mutateWatchlists;
};

export async function handleShareVisibilityPost(
  request: Request,
  context: RouteContext,
  dependencies: VisibilityRouteDependencies = { mutateWatchlists },
) {
  try {
    const body = (await request.json()) as { public?: boolean };
    const { watchlistId, shareId } = await context.params;
    const payload = await dependencies.mutateWatchlists(
      {
        action: "set-share-visibility",
        watchlistId: Number(watchlistId),
        shareId: Number(shareId),
        public: body.public === true,
      },
      {
        apiHeaders: await buildForwardedAuthHeaders(request),
      },
    );
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Share visibility update failed";
    const status =
      error instanceof WatchlistServiceError ? error.status : error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  return handleShareVisibilityPost(request, context);
}
