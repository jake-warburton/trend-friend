import assert from "node:assert/strict";
import test from "node:test";

import { handleAlertsGet, handleAlertsPost } from "@/app/api/alerts/route";
import { handleWatchlistsGet, handleWatchlistsPost } from "@/app/api/watchlists/route";
import type { AlertMutationBody, WatchlistMutationBody } from "@/lib/server/watchlist-service";

type WatchlistState = {
  watchlists: Array<{
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string;
    items: Array<{ trendId: string; trendName: string; addedAt: string }>;
    shares: Array<unknown>;
  }>;
  alerts: Array<{
    id: number;
    watchlistId: number;
    name: string;
    ruleType: string;
    threshold: number;
    enabled: boolean;
    createdAt: string;
  }>;
  matches: Array<unknown>;
};

type AlertEventState = {
  id: number;
  ruleId: number;
  watchlistId: number;
  trendId: string;
  trendName: string;
  ruleType: string;
  threshold: number;
  currentValue: number;
  message: string;
  triggeredAt: string;
  read: boolean;
};

test("local fallback smoke flow covers watchlist create, alert create, unread list, and mark-read", async () => {
  const now = "2026-03-10T12:00:00Z";
  const watchlistState: WatchlistState = {
    watchlists: [],
    alerts: [],
    matches: [],
  };
  const alertEvents: AlertEventState[] = [];
  let nextWatchlistId = 1;
  let nextAlertId = 1;
  let nextEventId = 1;

  const watchlistDependencies = {
    listWatchlists: async () => structuredClone(watchlistState),
    mutateWatchlists: async (body: WatchlistMutationBody) => {
      if (body.action === "create-watchlist") {
        watchlistState.watchlists.unshift({
          id: nextWatchlistId,
          name: body.name,
          createdAt: now,
          updatedAt: now,
          items: [],
          shares: [],
        });
        nextWatchlistId += 1;
      }
      return structuredClone(watchlistState);
    },
  };

  const alertDependencies = {
    listAlerts: async (unreadOnly: boolean) => ({
      alerts: alertEvents.filter((event) => (unreadOnly ? !event.read : true)).map((event) => ({ ...event })),
    }),
    mutateAlerts: async (body: AlertMutationBody) => {
      if ("action" in body) {
        for (const eventId of body.eventIds) {
          const event = alertEvents.find((item) => item.id === eventId);
          if (event) {
            event.read = true;
          }
        }
        return { updated: body.eventIds.length };
      }

      watchlistState.alerts.unshift({
        id: nextAlertId,
        watchlistId: body.watchlistId,
        name: body.name,
        ruleType: body.ruleType,
        threshold: body.threshold,
        enabled: true,
        createdAt: now,
      });

      alertEvents.unshift({
        id: nextEventId,
        ruleId: nextAlertId,
        watchlistId: body.watchlistId,
        trendId: "ai-agents",
        trendName: "AI Agents",
        ruleType: body.ruleType,
        threshold: body.threshold,
        currentValue: 42,
        message: "AI Agents score 42 >= threshold",
        triggeredAt: now,
        read: false,
      });

      nextAlertId += 1;
      nextEventId += 1;
      return structuredClone(watchlistState);
    },
  };

  const createWatchlistResponse = await handleWatchlistsPost(
    new Request("http://localhost/api/watchlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-watchlist", name: "Local Smoke" }),
    }),
    watchlistDependencies,
  );

  assert.equal(createWatchlistResponse.status, 200);
  const createWatchlistPayload = (await createWatchlistResponse.json()) as WatchlistState;
  assert.equal(createWatchlistPayload.watchlists[0]?.name, "Local Smoke");

  const listWatchlistsResponse = await handleWatchlistsGet(undefined, watchlistDependencies);
  assert.equal(listWatchlistsResponse.status, 200);
  const listWatchlistsPayload = (await listWatchlistsResponse.json()) as WatchlistState;
  assert.equal(listWatchlistsPayload.watchlists.length, 1);

  const createAlertResponse = await handleAlertsPost(
    new Request("http://localhost/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        watchlistId: 1,
        name: "Score >= 25",
        ruleType: "score_above",
        threshold: 25,
      }),
    }),
    alertDependencies,
  );

  assert.equal(createAlertResponse.status, 200);

  const unreadAlertsResponse = await handleAlertsGet(
    new Request("http://localhost/api/alerts?unread_only=true"),
    alertDependencies,
  );
  assert.equal(unreadAlertsResponse.status, 200);
  const unreadAlertsPayload = (await unreadAlertsResponse.json()) as { alerts: AlertEventState[] };
  assert.equal(unreadAlertsPayload.alerts.length, 1);
  assert.equal(unreadAlertsPayload.alerts[0]?.read, false);

  const markReadResponse = await handleAlertsPost(
    new Request("http://localhost/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-read", eventIds: [1] }),
    }),
    alertDependencies,
  );

  assert.equal(markReadResponse.status, 200);
  assert.deepEqual(await markReadResponse.json(), { updated: 1 });

  const unreadAfterMarkReadResponse = await handleAlertsGet(
    new Request("http://localhost/api/alerts?unread_only=true"),
    alertDependencies,
  );
  assert.equal(unreadAfterMarkReadResponse.status, 200);
  const unreadAfterMarkReadPayload = (await unreadAfterMarkReadResponse.json()) as { alerts: AlertEventState[] };
  assert.deepEqual(unreadAfterMarkReadPayload.alerts, []);
});
