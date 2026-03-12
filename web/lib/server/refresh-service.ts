import { ApiError } from "@/lib/api-client";

type RefreshDependencies = {
  apiEnabled?: boolean;
  apiPost?: <T>(path: string, body: unknown) => Promise<T>;
};

export function hasRefreshApi(): boolean {
  return !!process.env.SIGNAL_EYE_API_URL;
}

export async function refreshData(dependencies: RefreshDependencies = {}): Promise<Record<string, unknown>> {
  if (dependencies.apiEnabled ?? hasRefreshApi()) {
    const apiPost = dependencies.apiPost ?? defaultApiPost;
    return apiPost<Record<string, unknown>>("/refresh", {});
  }
  return { ok: true, revalidated: true };
}

export function getRefreshErrorStatus(error: unknown): number {
  if (error instanceof ApiError) {
    return error.status;
  }
  return 500;
}

async function defaultApiPost<T>(apiPath: string, body: unknown): Promise<T> {
  const { apiPost } = await import("@/lib/api-client");
  const refreshSecret = process.env.SIGNAL_EYE_REFRESH_SECRET;
  return apiPost<T>(apiPath, body, {
    headers: refreshSecret
      ? { "X-Trend-Friend-Refresh-Secret": refreshSecret }
      : undefined,
  });
}
