const REFRESH_INTERVAL_MS = 60_000;

export async function register() {
  // Only run server-side scheduled refresh in the Node.js runtime
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { refreshData, RefreshConflictError } = await import("@/lib/server/refresh-service");

  setInterval(async () => {
    try {
      await refreshData();
    } catch (error) {
      if (error instanceof RefreshConflictError) {
        return; // another refresh is already running, skip
      }
      console.error("[scheduled-refresh]", error instanceof Error ? error.message : error);
    }
  }, REFRESH_INTERVAL_MS);
}
