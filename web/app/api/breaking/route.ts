import { NextResponse } from "next/server";

import { loadBreakingFeed } from "@/lib/trends";

const GITHUB_TOKEN = process.env.TOKEN_DISPATCH || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "trend-friend";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

let lastDispatchAt = 0;

async function triggerTwitterRefresh(): Promise<void> {
  const now = Date.now();
  // Rate limit: don't dispatch more than once per 2 minutes
  if (now - lastDispatchAt < STALE_THRESHOLD_MS) return;
  if (!GITHUB_TOKEN || !GITHUB_OWNER) return;

  lastDispatchAt = now;
  try {
    await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/refresh-twitter.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      },
    );
  } catch {
    // Fire-and-forget — don't block the response
  }
}

export async function GET() {
  const feed = await loadBreakingFeed();

  // If feed is stale or missing, trigger a GitHub Actions refresh
  if (feed?.updatedAt) {
    const age = Date.now() - new Date(feed.updatedAt).getTime();
    if (age > STALE_THRESHOLD_MS) {
      void triggerTwitterRefresh();
    }
  } else {
    void triggerTwitterRefresh();
  }

  return NextResponse.json(feed, {
    headers: { "Cache-Control": "s-maxage=55, stale-while-revalidate=10" },
  });
}
