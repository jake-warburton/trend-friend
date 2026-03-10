import { NextResponse } from "next/server";

import { listPublicWatchlists } from "@/lib/server/watchlist-service";

export async function GET() {
  try {
    const payload = await listPublicWatchlists();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Community watchlists unavailable";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
