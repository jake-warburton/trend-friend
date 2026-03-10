import { apiGet, apiPost, ApiError } from "@/lib/api-client";

export const SESSION_COOKIE_NAME = "tf_session";

export type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
};

export type AuthStatusResponse = {
  authEnabled: boolean;
  user: AuthUser | null;
};

export type AuthDependencies = {
  apiEnabled?: boolean;
  apiGet?: <T>(path: string, options?: { headers?: HeadersInit }) => Promise<T>;
  apiPost?: <T>(path: string, body: unknown, options?: { headers?: HeadersInit }) => Promise<T>;
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

export function hasApi(): boolean {
  return !!process.env.TREND_FRIEND_API_URL;
}

export async function registerUser(
  body: { username: string; password: string; displayName?: string },
  dependencies: AuthDependencies = {},
): Promise<AuthResponse> {
  return runAuthMutation("/auth/register", body, dependencies);
}

export async function loginUser(
  body: { username: string; password: string },
  dependencies: AuthDependencies = {},
): Promise<AuthResponse> {
  return runAuthMutation("/auth/login", body, dependencies);
}

export async function logoutUser(
  requestHeaders?: HeadersInit,
  dependencies: AuthDependencies = {},
): Promise<{ ok: boolean }> {
  if (!(dependencies.apiEnabled ?? hasApi())) {
    return { ok: true };
  }
  return (dependencies.apiPost ?? apiPost)("/auth/logout", {}, { headers: requestHeaders });
}

export async function getCurrentUser(
  requestHeaders?: HeadersInit,
  dependencies: AuthDependencies = {},
): Promise<AuthStatusResponse> {
  if (!(dependencies.apiEnabled ?? hasApi())) {
    return { authEnabled: false, user: null };
  }
  try {
    const payload = await (dependencies.apiGet ?? apiGet)<{ user: AuthUser }>("/auth/me", { headers: requestHeaders });
    return { authEnabled: true, user: payload.user };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { authEnabled: true, user: null };
    }
    throw error;
  }
}

async function runAuthMutation(
  path: string,
  body: unknown,
  dependencies: AuthDependencies,
): Promise<AuthResponse> {
  if (!(dependencies.apiEnabled ?? hasApi())) {
    throw new AuthServiceError(501, "Authentication requires API mode");
  }
  try {
    return await (dependencies.apiPost ?? apiPost)<AuthResponse>(path, body);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new AuthServiceError(error.status, error.message);
    }
    throw error;
  }
}
