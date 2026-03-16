import { NextResponse } from "next/server";

import { readAdIntelligence } from "@/lib/trends";

export const revalidate = 3600;

export async function GET() {
  const data = await readAdIntelligence();
  return NextResponse.json(data);
}
