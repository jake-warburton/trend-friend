/**
 * HTTP client for the Trend Friend Python REST API.
 *
 * Server-side only — used by Next.js server components and API routes
 * to fetch data from the FastAPI backend instead of reading JSON files.
 */

const API_BASE_URL = process.env.TREND_FRIEND_API_URL ?? "http://localhost:8000";

export type ApiRequestOptions = {
  headers?: HeadersInit;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}/api/v1${path}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `API ${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}/api/v1${path}`;
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `API ${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function apiDelete<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}/api/v1${path}`;
  const response = await fetch(url, {
    method: "DELETE",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `API ${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}
