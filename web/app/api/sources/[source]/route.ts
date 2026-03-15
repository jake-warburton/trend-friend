import { NextResponse } from "next/server";

import { loadSourceSummary } from "@/lib/trends";

type RouteContext = {
  params: Promise<{ source: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { source } = await context.params;
  const summary = await loadSourceSummary(source);
  if (summary === null) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "s-maxage=2400, stale-while-revalidate=600" },
  });
}
