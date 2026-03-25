import { isServerRefreshLoopEnabled } from "@/lib/runtime-flags";

const REFRESH_INTERVAL_MS = 300_000;

export async function register() {
  // Never run this loop unless it is explicitly enabled for a self-hosted
  // Node.js runtime. On Vercel it can fan out across instances and burn CPU.
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    !isServerRefreshLoopEnabled()
  ) {
    return;
  }

  const { refreshData } = await import("@/lib/server/refresh-service");

  setInterval(async () => {
    try {
      await refreshData();
    } catch (error) {
      console.error("[scheduled-refresh]", error instanceof Error ? error.message : error);
    }
  }, REFRESH_INTERVAL_MS);
}
