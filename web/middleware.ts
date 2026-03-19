import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Routes that require Supabase session handling (auth checks / token refresh).
 * All other routes bypass middleware entirely so Vercel's CDN can cache them.
 */
const AUTH_ROUTES = ["/admin", "/settings", "/login", "/signup", "/auth"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
  if (request.nextUrl.pathname.startsWith("/admin") && !user && !isScreenshot) {
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
    "/settings/:path*",
    "/login",
    "/signup",
    "/auth/:path*",
  ],
};
