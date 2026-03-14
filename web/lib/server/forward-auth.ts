import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function buildForwardedAuthHeaders(request: Request): Promise<HeadersInit | undefined> {
  // Try to extract Supabase access token from server client
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { authorization: `Bearer ${session.access_token}` };
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
