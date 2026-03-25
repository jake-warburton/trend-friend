const SUPABASE_URL_ENV_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_ENV_VAR = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  "Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable authentication.";

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

function readRequiredEnvValue(
  env: NodeJS.ProcessEnv,
  key: string,
): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

function readDefaultSupabaseUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return value ? value : null;
}

function readDefaultSupabasePublishableKey(): string | null {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return value ? value : null;
}

export function getSupabasePublicConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabasePublicConfig | null {
  const url =
    env === process.env
      ? readDefaultSupabaseUrl()
      : readRequiredEnvValue(env, SUPABASE_URL_ENV_VAR);
  const publishableKey =
    env === process.env
      ? readDefaultSupabasePublishableKey()
      : readRequiredEnvValue(env, SUPABASE_PUBLISHABLE_KEY_ENV_VAR);

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function isSupabaseConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return getSupabasePublicConfig(env) !== null;
}

export function requireSupabasePublicConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabasePublicConfig {
  const config = getSupabasePublicConfig(env);
  if (!config) {
    throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);
  }
  return config;
}
