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

export async function GET(request: Request) {
  try {
    if (hasApi()) {
      const { apiGet } = await import("@/lib/api-client");
      const { searchParams } = new URL(request.url);
      const unreadOnly = searchParams.get("unread_only") === "true";
      const apiPath = unreadOnly ? "/alerts?unread_only=true" : "/alerts";
      const payload = await apiGet<object>(apiPath);
      return NextResponse.json(payload);
    }
    // Fallback: return empty events (alert events require the full API)
    return NextResponse.json({ events: [], total: 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (hasApi()) {
      const { apiPost } = await import("@/lib/api-client");
      if (body.action === "mark-read") {
        const payload = await apiPost<object>("/alerts/read", { eventIds: body.eventIds });
        return NextResponse.json(payload);
      }
      const payload = await apiPost<object>("/alerts/rules", body);
      return NextResponse.json(payload);
    }

    // Fallback: create alert rule via CLI script
    if (body.action === "mark-read") {
      return NextResponse.json({ ok: true });
    }
    const { stdout } = await execFileAsync("python3", [
      SCRIPT,
      "create-alert",
      "--watchlist-id", String(body.watchlistId),
      "--name", String(body.name),
      "--rule-type", String(body.ruleType),
      "--threshold", String(body.threshold),
    ], { cwd: PROJECT_ROOT, timeout: 15_000 });
    return NextResponse.json(JSON.parse(stdout));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
