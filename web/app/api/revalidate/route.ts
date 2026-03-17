import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { clearSupabasePayloadCache } from "@/lib/trends";

export async function POST(request: NextRequest) {
  const revalidateSecret = process.env.REVALIDATE_SECRET;
  if (!revalidateSecret) {
    return NextResponse.json({ error: "REVALIDATE_SECRET not configured" }, { status: 503 });
  }
  // Accept secret via header (preferred) or query param (legacy)
  const secret =
    request.headers.get("x-revalidate-secret") ??
    request.nextUrl.searchParams.get("secret");
  if (secret !== revalidateSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  clearSupabasePayloadCache();
  revalidateTag("supabase-payload", { expire: 0 });
  return NextResponse.json({ revalidated: true });
}
