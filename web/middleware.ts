import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  requireSupabasePublicConfig,
} from "@/lib/supabase/config";

const PROTECTED_ROUTES = ["/admin"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  const config = requireSupabasePublicConfig();

  const supabase = createServerClient(
    config.url,
    config.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh the session token (important — do not remove)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect routes that require authentication (bypass for screenshot captures)
  const isScreenshot = request.nextUrl.searchParams.get("screenshot") === "1";
  const isProtected = PROTECTED_ROUTES.some((route) => request.nextUrl.pathname.startsWith(route));
  if (isProtected && !user && !isScreenshot) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")) {
    return NextResponse.redirect(new URL("/explore", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/login",
    "/signup",
  ],
};
