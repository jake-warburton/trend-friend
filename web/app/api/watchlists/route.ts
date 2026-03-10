import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

async function runWatchlistCommand(args: string[]) {
  const projectRoot = path.resolve(process.cwd(), "..");
  const { stdout } = await execFileAsync("python3", ["scripts/watchlists_api.py", ...args], {
    cwd: projectRoot,
    timeout: 30_000,
  });
  return JSON.parse(stdout) as object;
}

export async function GET() {
  const payload = await runWatchlistCommand(["list"]);
  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as
      | { action: "create-watchlist"; name: string }
      | { action: "add-item"; watchlistId: number; trendId: string; trendName: string }
      | { action: "remove-item"; watchlistId: number; trendId: string };

    if (body.action === "create-watchlist") {
      const payload = await runWatchlistCommand(["create-watchlist", "--name", body.name]);
      return NextResponse.json(payload);
    }
    if (body.action === "add-item") {
      const payload = await runWatchlistCommand([
        "add-item",
        "--watchlist-id",
        String(body.watchlistId),
        "--trend-id",
        body.trendId,
        "--trend-name",
        body.trendName,
      ]);
      return NextResponse.json(payload);
    }
    const payload = await runWatchlistCommand([
      "remove-item",
      "--watchlist-id",
      String(body.watchlistId),
      "--trend-id",
      body.trendId,
    ]);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Watchlist request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
