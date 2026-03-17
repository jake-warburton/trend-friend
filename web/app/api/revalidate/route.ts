import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { clearSupabasePayloadCache } from "@/lib/trends";

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || "";

export async function POST(request: NextRequest) {
  // Accept secret via header (preferred) or query param (legacy)
  const secret =
    request.headers.get("x-revalidate-secret") ??
    request.nextUrl.searchParams.get("secret");
  if (!REVALIDATE_SECRET || secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  clearSupabasePayloadCache();
  revalidateTag("supabase-payload", { expire: 0 });
  return NextResponse.json({ revalidated: true });
}
