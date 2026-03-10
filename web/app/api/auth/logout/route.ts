import { NextResponse } from "next/server";

import { AuthServiceError, logoutUser, SESSION_COOKIE_NAME } from "@/lib/server/auth-service";
import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";

type LogoutDependencies = {
  logoutUser: typeof logoutUser;
};

export async function handleAuthLogoutPost(
  request: Request,
  dependencies: LogoutDependencies = { logoutUser },
) {
  try {
    await dependencies.logoutUser(buildForwardedAuthHeaders(request));
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Logout failed";
    const status = error instanceof AuthServiceError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  return handleAuthLogoutPost(request);
}
