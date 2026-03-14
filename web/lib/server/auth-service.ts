import { createSupabaseServerClient } from "@/lib/supabase/server";

export const SESSION_COOKIE_NAME = "tf_session";

export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string;
  isAdmin: boolean;
  accountTier: "free" | "pro";
  createdAt: string;
};

export type AuthStatusResponse = {
  authEnabled: boolean;
  user: AuthUser | null;
};

export class AuthServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export async function getCurrentUser(): Promise<AuthStatusResponse> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { authEnabled: true, user: null };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, account_tier")
      .eq("id", user.id)
      .single();

    return {
      authEnabled: true,
      user: {
        id: user.id,
        email: user.email ?? null,
        displayName:
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email ??
          "",
        isAdmin: profile?.is_admin ?? false,
        accountTier: profile?.account_tier === "pro" ? "pro" : "free",
        createdAt: user.created_at,
      },
    };
  } catch {
    return { authEnabled: false, user: null };
  }
}
