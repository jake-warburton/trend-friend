import { NextResponse } from "next/server";

import { requirePro } from "@/lib/server/require-pro";
import { readAdIntelligence } from "@/lib/trends";

export async function GET() {
  const check = await requirePro();
  if (!check.authorized) return check.response;
  const data = await readAdIntelligence();
  return NextResponse.json(data);
}
