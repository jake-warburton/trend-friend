import { NextResponse } from "next/server";

import { loadTrendExplorer } from "@/lib/trends";

export async function GET() {
  const explorer = await loadTrendExplorer();
  return NextResponse.json(explorer);
}
