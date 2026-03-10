import { NextResponse } from "next/server";

import { loadTrendDetail } from "@/lib/trends";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const trend = await loadTrendDetail(slug);
  if (trend === null) {
    return NextResponse.json({ error: "Trend not found" }, { status: 404 });
  }
  return NextResponse.json(trend);
}
