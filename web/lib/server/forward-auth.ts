import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function buildForwardedAuthHeaders(request: Request): Promise<HeadersInit | undefined> {
  // Try to extract Supabase access token from server client
  try {
    const supabase = await createSupabaseServerClient();
    // Validate the JWT server-side first (getUser() makes a network call to Supabase)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Token is validated; now read session from cookie to get access_token for forwarding
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        return { authorization: `Bearer ${session.access_token}` };
      }
    }
  } catch {
    // Fall through to legacy header forwarding
  }

  // Legacy fallback: forward raw cookies/authorization headers
  const cookie = request.headers.get("cookie");
  const authorization = request.headers.get("authorization");

  if (!cookie && !authorization) {
    return undefined;
  }

  const headers: Record<string, string> = {};
  if (cookie) {
    headers.cookie = cookie;
  }
  if (authorization) {
    headers.authorization = authorization;
  }
  return headers;
}
