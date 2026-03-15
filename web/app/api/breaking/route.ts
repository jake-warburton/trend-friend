import { NextResponse } from "next/server";

import { loadBreakingFeed } from "@/lib/trends";

export async function GET() {
  const feed = await loadBreakingFeed();
  return NextResponse.json(feed);
}
