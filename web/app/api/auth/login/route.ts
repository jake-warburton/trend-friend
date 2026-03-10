import { NextResponse } from "next/server";

import { AuthServiceError, loginUser, SESSION_COOKIE_NAME } from "@/lib/server/auth-service";

type LoginDependencies = {
  loginUser: typeof loginUser;
};

export async function handleAuthLoginPost(
  request: Request,
  dependencies: LoginDependencies = { loginUser },
) {
  try {
    const body = (await request.json()) as { username: string; password: string };
    const payload = await dependencies.loginUser(body);
    const response = NextResponse.json({ authEnabled: true, user: payload.user });
    response.cookies.set(SESSION_COOKIE_NAME, payload.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    const status = error instanceof AuthServiceError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  return handleAuthLoginPost(request);
}
