import { NextResponse } from "next/server";

import { apiGet, apiPost, ApiError } from "@/lib/api-client";

export async function GET() {
  try {
    const payload = await apiGet<object>("/watchlists");
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watchlist request failed";
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as
      | { action: "create-watchlist"; name: string }
      | { action: "add-item"; watchlistId: number; trendId: string; trendName: string }
      | { action: "remove-item"; watchlistId: number; trendId: string };

    let payload: object;
    if (body.action === "create-watchlist") {
      payload = await apiPost<object>("/watchlists", { name: body.name });
    } else if (body.action === "add-item") {
      payload = await apiPost<object>("/watchlists/items", {
        action: "add",
        watchlistId: body.watchlistId,
        trendId: body.trendId,
        trendName: body.trendName,
      });
    } else {
      payload = await apiPost<object>("/watchlists/items", {
        action: "remove",
        watchlistId: body.watchlistId,
        trendId: body.trendId,
      });
    }
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watchlist request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
