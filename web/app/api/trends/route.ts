import { NextResponse } from "next/server";

import { loadTrendExplorer } from "@/lib/trends";

export const revalidate = 172800;

export async function GET() {
  const explorer = await loadTrendExplorer();
  return NextResponse.json(explorer);
}
