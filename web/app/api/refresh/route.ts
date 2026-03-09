import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

export async function POST() {
  const projectRoot = path.resolve(process.cwd(), "..");

  try {
    await execFileAsync("python3", ["scripts/run_ingestion.py"], {
      cwd: projectRoot,
      timeout: 120_000,
    });
    await execFileAsync("python3", ["scripts/export_web_data.py"], {
      cwd: projectRoot,
      timeout: 60_000,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
