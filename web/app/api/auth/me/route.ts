import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth-service";

export async function GET() {
  try {
    const payload = await getCurrentUser();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
