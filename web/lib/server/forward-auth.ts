export function buildForwardedAuthHeaders(request: Request): HeadersInit | undefined {
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
