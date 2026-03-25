import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicConfig } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const config = requireSupabasePublicConfig();
  return createBrowserClient(
    config.url,
    config.publishableKey,
  );
}
