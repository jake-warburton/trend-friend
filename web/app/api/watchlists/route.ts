import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const SCRIPT = path.join(PROJECT_ROOT, "scripts", "watchlists_api.py");

function hasApi(): boolean {
  return !!process.env.TREND_FRIEND_API_URL;
}

async function runScript(...args: string[]): Promise<object> {
  const { stdout } = await execFileAsync("python3", [SCRIPT, ...args], {
    cwd: PROJECT_ROOT,
    timeout: 15_000,
  });
  return JSON.parse(stdout);
}

export async function GET() {
  try {
    if (hasApi()) {
      const { apiGet } = await import("@/lib/api-client");
      const payload = await apiGet<object>("/watchlists");
      return NextResponse.json(payload);
    }
    const payload = await runScript("list");
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watchlist request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as
      | { action: "create-watchlist"; name: string }
      | { action: "add-item"; watchlistId: number; trendId: string; trendName: string }
      | { action: "remove-item"; watchlistId: number; trendId: string };

    if (hasApi()) {
      const { apiPost } = await import("@/lib/api-client");
      let payload: object;
      if (body.action === "create-watchlist") {
        payload = await apiPost<object>("/watchlists", { name: body.name });
      } else if (body.action === "add-item") {
        payload = await apiPost<object>("/watchlists/items", {
          action: "add",
          watchlistId: body.watchlistId,
          trendId: body.trendId,
          trendName: body.trendName,
        });
      } else {
        payload = await apiPost<object>("/watchlists/items", {
          action: "remove",
          watchlistId: body.watchlistId,
          trendId: body.trendId,
        });
      }
      return NextResponse.json(payload);
    }

    let payload: object;
    if (body.action === "create-watchlist") {
      payload = await runScript("create-watchlist", "--name", body.name);
    } else if (body.action === "add-item") {
      payload = await runScript(
        "add-item",
        "--watchlist-id", String(body.watchlistId),
        "--trend-id", body.trendId,
        "--trend-name", body.trendName,
      );
    } else {
      payload = await runScript(
        "remove-item",
        "--watchlist-id", String(body.watchlistId),
        "--trend-id", body.trendId,
      );
    }
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watchlist request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
