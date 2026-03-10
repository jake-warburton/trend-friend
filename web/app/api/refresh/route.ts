import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

async function refreshViaApi(): Promise<object> {
  const apiUrl = process.env.TREND_FRIEND_API_URL;
  if (!apiUrl) throw new Error("no api url");
  const { apiPost, ApiError } = await import("@/lib/api-client");
  return apiPost<object>("/refresh", {});
}

async function refreshViaSubprocess(): Promise<{ ok: true }> {
  const projectRoot = path.resolve(process.cwd(), "..");
  await execFileAsync("python3", ["scripts/run_ingestion.py"], {
    cwd: projectRoot,
    timeout: 120_000,
  });
  await execFileAsync("python3", ["scripts/export_web_data.py"], {
    cwd: projectRoot,
    timeout: 60_000,
  });
  return { ok: true };
}

export async function POST() {
  try {
    const payload = await refreshViaApi().catch(() => refreshViaSubprocess());
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
