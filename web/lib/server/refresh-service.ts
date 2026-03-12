import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { ApiError } from "@/lib/api-client";

const execFileAsync = promisify(execFile);

let refreshInProgress = false;

type RefreshDependencies = {
  apiEnabled?: boolean;
  apiPost?: <T>(path: string, body: unknown) => Promise<T>;
  runIngestion?: () => Promise<void>;
  runExport?: () => Promise<void>;
  acquireLock?: () => boolean;
  releaseLock?: () => void;
};

export class RefreshConflictError extends Error {
  constructor(message = "A refresh is already in progress") {
    super(message);
    this.name = "RefreshConflictError";
  }
}

export class RefreshUnavailableError extends Error {
  constructor(message = "Manual refresh requires a configured backend API in hosted environments") {
    super(message);
    this.name = "RefreshUnavailableError";
  }
}

export function hasRefreshApi(): boolean {
  return !!process.env.SIGNAL_EYE_API_URL;
}

export function canRunLocalRefreshScripts(): boolean {
  return !process.env.VERCEL;
}

export function acquireLocalRefreshLock(): boolean {
  if (refreshInProgress) {
    return false;
  }
  refreshInProgress = true;
  return true;
}

export function releaseLocalRefreshLock(): void {
  refreshInProgress = false;
}

export async function refreshData(dependencies: RefreshDependencies = {}): Promise<Record<string, unknown>> {
  if (dependencies.apiEnabled ?? hasRefreshApi()) {
    const apiPost = dependencies.apiPost ?? defaultApiPost;
    return apiPost<Record<string, unknown>>("/refresh", {});
  }

  if (!(dependencies.runIngestion && dependencies.runExport) && !canRunLocalRefreshScripts()) {
    throw new RefreshUnavailableError();
  }

  const acquireLock = dependencies.acquireLock ?? acquireLocalRefreshLock;
  const releaseLock = dependencies.releaseLock ?? releaseLocalRefreshLock;

  if (!acquireLock()) {
    throw new RefreshConflictError();
  }

  try {
    await (dependencies.runIngestion ?? runIngestion)();
    await (dependencies.runExport ?? runExport)();
    return { ok: true };
  } finally {
    releaseLock();
  }
}

export function getRefreshErrorStatus(error: unknown): number {
  if (error instanceof RefreshConflictError) {
    return 409;
  }
  if (error instanceof RefreshUnavailableError) {
    return 501;
  }
  if (error instanceof ApiError) {
    return error.status;
  }
  return 500;
}

export function buildLocalRefreshEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const projectEnv = readProjectEnv();
  return {
    ...baseEnv,
    ...projectEnv,
    SIGNAL_EYE_ENABLE_POSTGRES_RUNTIME: baseEnv.SIGNAL_EYE_ENABLE_POSTGRES_RUNTIME ?? "true",
  };
}

function readProjectEnv(projectRoot = path.resolve(process.cwd(), "..")): NodeJS.ProcessEnv {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) {
    return {} as NodeJS.ProcessEnv;
  }

  const parsed = {} as NodeJS.ProcessEnv;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }
    parsed[key] = value;
  }
  return parsed;
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

async function runIngestion(): Promise<void> {
  const projectRoot = path.resolve(process.cwd(), "..");
  await execFileAsync("python3", ["scripts/run_ingestion.py"], {
    cwd: projectRoot,
    env: buildLocalRefreshEnv(),
    timeout: 120_000,
  });
}

async function runExport(): Promise<void> {
  const projectRoot = path.resolve(process.cwd(), "..");
  await execFileAsync("python3", ["scripts/export_web_data.py"], {
    cwd: projectRoot,
    env: buildLocalRefreshEnv(),
    timeout: 60_000,
  });
}
