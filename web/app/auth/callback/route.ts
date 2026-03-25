import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/explore";

  // Prevent open redirect — only allow relative paths on this origin
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/explore";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/login?error=auth_not_configured`);
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // On error, redirect to login with an error indicator
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
