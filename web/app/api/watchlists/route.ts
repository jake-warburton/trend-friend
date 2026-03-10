import { NextResponse } from "next/server";

import { listWatchlists, mutateWatchlists, type WatchlistMutationBody } from "@/lib/server/watchlist-service";

export async function GET() {
  try {
    const payload = await listWatchlists();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watchlist request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WatchlistMutationBody;
    const payload = await mutateWatchlists(body);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watchlist request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
