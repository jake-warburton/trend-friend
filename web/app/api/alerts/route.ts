import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

async function runAlertCommand(args: string[]) {
  const projectRoot = path.resolve(process.cwd(), "..");
  const { stdout } = await execFileAsync("python3", ["scripts/watchlists_api.py", ...args], {
    cwd: projectRoot,
    timeout: 30_000,
  });
  return JSON.parse(stdout) as object;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      watchlistId: number;
      name: string;
      ruleType: string;
      threshold: number;
    };
    const payload = await runAlertCommand([
      "create-alert",
      "--watchlist-id",
      String(body.watchlistId),
      "--name",
      body.name,
      "--rule-type",
      body.ruleType,
      "--threshold",
      String(body.threshold),
    ]);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
