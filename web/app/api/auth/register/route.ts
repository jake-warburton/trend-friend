import { NextResponse } from "next/server";

import { AuthServiceError, registerUser, SESSION_COOKIE_NAME } from "@/lib/server/auth-service";

type RegisterDependencies = {
  registerUser: typeof registerUser;
};

export async function handleAuthRegisterPost(
  request: Request,
  dependencies: RegisterDependencies = { registerUser },
) {
  try {
    const body = (await request.json()) as { username: string; password: string; displayName?: string };
    const payload = await dependencies.registerUser(body);
    const response = NextResponse.json({ authEnabled: true, user: payload.user });
    response.cookies.set(SESSION_COOKIE_NAME, payload.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    const status = error instanceof AuthServiceError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  return handleAuthRegisterPost(request);
}
