import { NextResponse } from "next/server";

import { AuthServiceError, getCurrentUser } from "@/lib/server/auth-service";
import { buildForwardedAuthHeaders } from "@/lib/server/forward-auth";

type AuthMeDependencies = {
  getCurrentUser: typeof getCurrentUser;
};

export async function handleAuthMeGet(
  request: Request,
  dependencies: AuthMeDependencies = { getCurrentUser },
) {
  try {
    const payload = await dependencies.getCurrentUser(buildForwardedAuthHeaders(request));
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication lookup failed";
    const status = error instanceof AuthServiceError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  return handleAuthMeGet(request);
}
