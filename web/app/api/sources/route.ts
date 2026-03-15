import { NextResponse } from "next/server";

import { loadSourceSummaries } from "@/lib/trends";

export const revalidate = 2400;

export async function GET() {
  const sources = await loadSourceSummaries();
  return NextResponse.json(sources);
}
