import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type WatchlistMutationBody =
  | { action: "create-watchlist"; name: string }
  | { action: "add-item"; watchlistId: number; trendId: string; trendName: string }
  | { action: "remove-item"; watchlistId: number; trendId: string }
  | { action: "revoke-share"; watchlistId: number; shareId: number }
  | { action: "set-share-visibility"; watchlistId: number; shareId: number; public: boolean }
  | { action: "set-share-attribution"; watchlistId: number; shareId: number; showCreator: boolean }
  | { action: "set-share-expiration"; watchlistId: number; shareId: number; expiresAt: string | null };

export type AlertMutationBody =
  | { action: "mark-read"; eventIds: number[] }
  | { watchlistId: number; name: string; ruleType: string; threshold: number };

type JsonValue = Record<string, unknown>;

type ServiceDependencies = {
  apiEnabled?: boolean;
  apiGet?: <T>(path: string, options?: { headers?: HeadersInit }) => Promise<T>;
  apiPost?: <T>(path: string, body: unknown, options?: { headers?: HeadersInit }) => Promise<T>;
  apiHeaders?: HeadersInit;
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
    return (dependencies.apiGet ?? defaultApiGet)("/watchlists", {
      headers: dependencies.apiHeaders,
    });
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
      return apiPost("/watchlists", { name: body.name }, { headers: dependencies.apiHeaders });
    }
    if (body.action === "add-item") {
      return apiPost("/watchlists/items", {
        action: "add",
        watchlistId: body.watchlistId,
        trendId: body.trendId,
        trendName: body.trendName,
      }, { headers: dependencies.apiHeaders });
    }
    if (body.action === "revoke-share") {
      return apiPost(
        `/watchlists/${body.watchlistId}/shares/${body.shareId}/revoke`,
        {},
        { headers: dependencies.apiHeaders },
      );
    }
    if (body.action === "set-share-visibility") {
      return apiPost(
        `/watchlists/${body.watchlistId}/shares/${body.shareId}/visibility`,
        { public: body.public },
        { headers: dependencies.apiHeaders },
      );
    }
    if (body.action === "set-share-attribution") {
      return apiPost(
        `/watchlists/${body.watchlistId}/shares/${body.shareId}/attribution`,
        { showCreator: body.showCreator },
        { headers: dependencies.apiHeaders },
      );
    }
    if (body.action === "set-share-expiration") {
      return apiPost(
        `/watchlists/${body.watchlistId}/shares/${body.shareId}/expiration`,
        { expiresAt: body.expiresAt },
        { headers: dependencies.apiHeaders },
      );
    }
    return apiPost("/watchlists/items", {
      action: "remove",
      watchlistId: body.watchlistId,
      trendId: body.trendId,
    }, { headers: dependencies.apiHeaders });
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
  if (body.action === "revoke-share") {
    return ensureSuccessPayload(await runScript("revoke-share", "--share-id", String(body.shareId)));
  }
  if (body.action === "set-share-visibility") {
    return ensureSuccessPayload(await runScript(
      "set-share-visibility",
      "--share-id",
      String(body.shareId),
      ...(body.public ? ["--public"] : []),
    ));
  }
  if (body.action === "set-share-attribution") {
    return ensureSuccessPayload(await runScript(
      "set-share-attribution",
      "--share-id",
      String(body.shareId),
      ...(body.showCreator ? ["--show-creator"] : []),
    ));
  }
  if (body.action === "set-share-expiration") {
    return ensureSuccessPayload(await runScript(
      "set-share-expiration",
      "--share-id",
      String(body.shareId),
      ...(body.expiresAt ? ["--expires-at", body.expiresAt] : []),
    ));
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
    return (dependencies.apiGet ?? defaultApiGet)(path, {
      headers: dependencies.apiHeaders,
    });
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
      return apiPost("/alerts/read", { eventIds: body.eventIds }, { headers: dependencies.apiHeaders });
    }
    return apiPost("/alerts/rules", body, { headers: dependencies.apiHeaders });
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
  showCreator = false,
  expiresAt: string | null = null,
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    return (dependencies.apiPost ?? defaultApiPost)(`/watchlists/${watchlistId}/share`, {
      public: isPublic,
      showCreator,
      expiresAt,
    }, {
      headers: dependencies.apiHeaders,
    });
  }
  return ensureSuccessPayload(await (dependencies.runScript ?? runWatchlistScript)(
    "share-watchlist",
    "--watchlist-id",
    String(watchlistId),
    ...(isPublic ? ["--public"] : []),
    ...(showCreator ? ["--show-creator"] : []),
    ...(expiresAt ? ["--expires-at", expiresAt] : []),
  ));
}

export async function getSharedWatchlist(
  token: string,
  dependencies: ServiceDependencies = {},
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    return (dependencies.apiGet ?? defaultApiGet)(`/shared/${token}`, {
      headers: dependencies.apiHeaders,
    });
  }
  return ensureSuccessPayload(await (dependencies.runScript ?? runWatchlistScript)("get-shared", "--token", token));
}

export async function listPublicWatchlists(
  dependencies: ServiceDependencies = {},
): Promise<JsonValue> {
  if (dependencies.apiEnabled ?? hasApi()) {
    return (dependencies.apiGet ?? defaultApiGet)("/community/watchlists", {
      headers: dependencies.apiHeaders,
    });
  }
  return (dependencies.runScript ?? runWatchlistScript)("list-public");
}

async function defaultApiGet<T>(apiPath: string, options?: { headers?: HeadersInit }): Promise<T> {
  const { apiGet } = await import("@/lib/api-client");
  return apiGet<T>(apiPath, options);
}

async function defaultApiPost<T>(apiPath: string, body: unknown, options?: { headers?: HeadersInit }): Promise<T> {
  const { apiPost } = await import("@/lib/api-client");
  return apiPost<T>(apiPath, body, options);
}

function ensureSuccessPayload(payload: JsonValue): JsonValue {
  if (typeof payload.error === "string") {
    const status = payload.error.includes("not found") ? 404 : 500;
    throw new WatchlistServiceError(status, payload.error);
  }
  return payload;
}
