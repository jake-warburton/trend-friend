import { NextResponse } from "next/server";

import { loadTrendExplorer } from "@/lib/trends";

export async function GET() {
  const explorer = await loadTrendExplorer();
  return NextResponse.json(explorer, {
    headers: { "Cache-Control": "s-maxage=2400, stale-while-revalidate=600" },
  });
}
