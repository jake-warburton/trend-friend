import { execFile } from "node:child_process";
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

export function hasRefreshApi(): boolean {
  return !!process.env.TREND_FRIEND_API_URL;
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
  if (error instanceof ApiError) {
    return error.status;
  }
  return 500;
}

async function defaultApiPost<T>(apiPath: string, body: unknown): Promise<T> {
  const { apiPost } = await import("@/lib/api-client");
  return apiPost<T>(apiPath, body);
}

async function runIngestion(): Promise<void> {
  const projectRoot = path.resolve(process.cwd(), "..");
  await execFileAsync("python3", ["scripts/run_ingestion.py"], {
    cwd: projectRoot,
    timeout: 120_000,
  });
}

async function runExport(): Promise<void> {
  const projectRoot = path.resolve(process.cwd(), "..");
  await execFileAsync("python3", ["scripts/export_web_data.py"], {
    cwd: projectRoot,
    timeout: 60_000,
  });
}
