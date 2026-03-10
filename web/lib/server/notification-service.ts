import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { ApiError } from "@/lib/api-client";

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const SCRIPT = path.join(PROJECT_ROOT, "scripts", "watchlists_api.py");

type JsonValue = Record<string, unknown>;

type ServiceDependencies = {
  apiEnabled?: boolean;
  apiGet?: <T>(path: string, options?: { headers?: HeadersInit }) => Promise<T>;
  apiPost?: <T>(path: string, body: unknown, options?: { headers?: HeadersInit }) => Promise<T>;
  apiDelete?: <T>(path: string, options?: { headers?: HeadersInit }) => Promise<T>;
  apiHeaders?: HeadersInit;
  runScript?: (...args: string[]) => Promise<JsonValue>;
};

export class NotificationServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "NotificationServiceError";
  }
}

export function hasApi(): boolean {
  return !!process.env.TREND_FRIEND_API_URL;
}

async function runNotificationScript(...args: string[]): Promise<JsonValue> {
  const { stdout } = await execFileAsync("python3", [SCRIPT, ...args], {
    cwd: PROJECT_ROOT,
    timeout: 15_000,
  });
  return JSON.parse(stdout) as JsonValue;
}

export async function listNotificationChannels(
  dependencies: ServiceDependencies = {},
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    return (dependencies.apiGet ?? defaultApiGet)("/notifications/channels", {
      headers: dependencies.apiHeaders,
    });
  }
  return (dependencies.runScript ?? runNotificationScript)("list-notification-channels");
}

export async function createNotificationChannel(
  destination: string,
  label: string,
  dependencies: ServiceDependencies = {},
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    return (dependencies.apiPost ?? defaultApiPost)(
      "/notifications/channels",
      { channelType: "webhook", destination, label },
      { headers: dependencies.apiHeaders },
    );
  }
  return ensureSuccessPayload(
    await (dependencies.runScript ?? runNotificationScript)(
      "create-notification-channel",
      "--destination",
      destination,
      "--label",
      label,
    ),
  );
}

export async function deleteNotificationChannel(
  channelId: number,
  dependencies: ServiceDependencies = {},
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    return (dependencies.apiDelete ?? defaultApiDelete)(
      `/notifications/channels/${channelId}`,
      { headers: dependencies.apiHeaders },
    );
  }
  return ensureSuccessPayload(
    await (dependencies.runScript ?? runNotificationScript)(
      "delete-notification-channel",
      "--channel-id",
      String(channelId),
    ),
  );
}

export async function testNotificationChannel(
  channelId: number,
  dependencies: ServiceDependencies = {},
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    return (dependencies.apiPost ?? defaultApiPost)(
      `/notifications/channels/${channelId}/test`,
      {},
      { headers: dependencies.apiHeaders },
    );
  }
  return ensureSuccessPayload(
    await (dependencies.runScript ?? runNotificationScript)(
      "test-notification-channel",
      "--channel-id",
      String(channelId),
    ),
  );
}

async function defaultApiGet<T>(apiPath: string, options?: { headers?: HeadersInit }): Promise<T> {
  const { apiGet } = await import("@/lib/api-client");
  return apiGet<T>(apiPath, options);
}

async function defaultApiPost<T>(apiPath: string, body: unknown, options?: { headers?: HeadersInit }): Promise<T> {
  const { apiPost } = await import("@/lib/api-client");
  return apiPost<T>(apiPath, body, options);
}

async function defaultApiDelete<T>(apiPath: string, options?: { headers?: HeadersInit }): Promise<T> {
  const { apiDelete } = await import("@/lib/api-client");
  return apiDelete<T>(apiPath, options);
}

function ensureSuccessPayload(payload: JsonValue): JsonValue {
  if (typeof payload.error === "string") {
    const status = payload.error.includes("not found") ? 404 : 500;
    throw new NotificationServiceError(status, payload.error);
  }
  return payload;
}

export function getErrorStatus(error: unknown): number {
  if (error instanceof NotificationServiceError) {
    return error.status;
  }
  if (error instanceof ApiError) {
    return error.status;
  }
  return 500;
}
