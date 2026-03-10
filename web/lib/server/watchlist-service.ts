import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type WatchlistMutationBody =
  | { action: "create-watchlist"; name: string }
  | { action: "add-item"; watchlistId: number; trendId: string; trendName: string }
  | { action: "remove-item"; watchlistId: number; trendId: string };

export type AlertMutationBody =
  | { action: "mark-read"; eventIds: number[] }
  | { watchlistId: number; name: string; ruleType: string; threshold: number };

type JsonValue = Record<string, unknown>;

type ServiceDependencies = {
  apiEnabled?: boolean;
  apiGet?: <T>(path: string) => Promise<T>;
  apiPost?: <T>(path: string, body: unknown) => Promise<T>;
  runScript?: (...args: string[]) => Promise<JsonValue>;
};

export class WatchlistServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "WatchlistServiceError";
  }
}

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const SCRIPT = path.join(PROJECT_ROOT, "scripts", "watchlists_api.py");

export function hasApi(): boolean {
  return !!process.env.TREND_FRIEND_API_URL;
}

export async function runWatchlistScript(...args: string[]): Promise<JsonValue> {
  const { stdout } = await execFileAsync("python3", [SCRIPT, ...args], {
    cwd: PROJECT_ROOT,
    timeout: 15_000,
  });
  return JSON.parse(stdout) as JsonValue;
}

export async function listWatchlists(dependencies: ServiceDependencies = {}): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    return (dependencies.apiGet ?? defaultApiGet)("/watchlists");
  }
  return (dependencies.runScript ?? runWatchlistScript)("list");
}

export async function mutateWatchlists(
  body: WatchlistMutationBody,
  dependencies: ServiceDependencies = {},
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    const apiPost = dependencies.apiPost ?? defaultApiPost;
    if (body.action === "create-watchlist") {
      return apiPost("/watchlists", { name: body.name });
    }
    if (body.action === "add-item") {
      return apiPost("/watchlists/items", {
        action: "add",
        watchlistId: body.watchlistId,
        trendId: body.trendId,
        trendName: body.trendName,
      });
    }
    return apiPost("/watchlists/items", {
      action: "remove",
      watchlistId: body.watchlistId,
      trendId: body.trendId,
    });
  }

  const runScript = dependencies.runScript ?? runWatchlistScript;
  if (body.action === "create-watchlist") {
    return runScript("create-watchlist", "--name", body.name);
  }
  if (body.action === "add-item") {
    return runScript(
      "add-item",
      "--watchlist-id",
      String(body.watchlistId),
      "--trend-id",
      body.trendId,
      "--trend-name",
      body.trendName,
    );
  }
  return runScript(
    "remove-item",
    "--watchlist-id",
    String(body.watchlistId),
    "--trend-id",
    body.trendId,
  );
}

export async function listAlerts(
  unreadOnly: boolean,
  dependencies: ServiceDependencies = {},
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    const path = unreadOnly ? "/alerts?unread_only=true" : "/alerts";
    return (dependencies.apiGet ?? defaultApiGet)(path);
  }
  return (dependencies.runScript ?? runWatchlistScript)(
    "list-alerts",
    ...(unreadOnly ? ["--unread-only"] : []),
  );
}

export async function mutateAlerts(
  body: AlertMutationBody,
  dependencies: ServiceDependencies = {},
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    const apiPost = dependencies.apiPost ?? defaultApiPost;
    if ("action" in body && body.action === "mark-read") {
      return apiPost("/alerts/read", { eventIds: body.eventIds });
    }
    return apiPost("/alerts/rules", body);
  }

  if ("action" in body && body.action === "mark-read") {
    return (dependencies.runScript ?? runWatchlistScript)(
      "mark-alerts-read",
      ...body.eventIds.flatMap((eventId) => ["--event-id", String(eventId)]),
    );
  }
  const alertRule = body as Exclude<AlertMutationBody, { action: "mark-read"; eventIds: number[] }>;
  return (dependencies.runScript ?? runWatchlistScript)(
    "create-alert",
    "--watchlist-id",
    String(alertRule.watchlistId),
    "--name",
    alertRule.name,
    "--rule-type",
    alertRule.ruleType,
    "--threshold",
    String(alertRule.threshold),
  );
}

export async function shareWatchlist(
  watchlistId: number,
  isPublic: boolean,
  dependencies: ServiceDependencies = {},
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    return (dependencies.apiPost ?? defaultApiPost)(`/watchlists/${watchlistId}/share`, { public: isPublic });
  }
  return ensureSuccessPayload(await (dependencies.runScript ?? runWatchlistScript)(
    "share-watchlist",
    "--watchlist-id",
    String(watchlistId),
    ...(isPublic ? ["--public"] : []),
  ));
}

export async function getSharedWatchlist(
  token: string,
  dependencies: ServiceDependencies = {},
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    return (dependencies.apiGet ?? defaultApiGet)(`/shared/${token}`);
  }
  return ensureSuccessPayload(await (dependencies.runScript ?? runWatchlistScript)("get-shared", "--token", token));
}

export async function listPublicWatchlists(
  dependencies: ServiceDependencies = {},
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    return (dependencies.apiGet ?? defaultApiGet)("/community/watchlists");
  }
  return (dependencies.runScript ?? runWatchlistScript)("list-public");
}

async function defaultApiGet<T>(apiPath: string): Promise<T> {
  const { apiGet } = await import("@/lib/api-client");
  return apiGet<T>(apiPath);
}

async function defaultApiPost<T>(apiPath: string, body: unknown): Promise<T> {
  const { apiPost } = await import("@/lib/api-client");
  return apiPost<T>(apiPath, body);
}

function ensureSuccessPayload(payload: JsonValue): JsonValue {
  if (typeof payload.error === "string") {
    const status = payload.error.includes("not found") ? 404 : 500;
    throw new WatchlistServiceError(status, payload.error);
  }
  return payload;
}
