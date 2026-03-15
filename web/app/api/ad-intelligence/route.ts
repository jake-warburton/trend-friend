import { NextResponse } from "next/server";

import { readAdIntelligence } from "@/lib/trends";

export async function GET() {
  const data = await readAdIntelligence();
  return NextResponse.json(data);
}
