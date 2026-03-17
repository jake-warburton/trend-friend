import { NextResponse } from "next/server";

import { loadTrendExplorer } from "@/lib/trends";

export const revalidate = 2400;

export async function GET() {
  const explorer = await loadTrendExplorer();
  return NextResponse.json(explorer);
}
