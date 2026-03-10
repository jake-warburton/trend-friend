import assert from "node:assert/strict";
import test from "node:test";

import { handleAlertsGet, handleAlertsPost } from "@/app/api/alerts/route";

test("alerts GET route returns unread alerts from the fallback service", async () => {
  const response = await handleAlertsGet(
    new Request("http://localhost/api/alerts?unread_only=true"),
    {
      listAlerts: async (unreadOnly) => ({
        unreadOnly,
        alerts: [
          {
            id: 1,
            trendId: "ai-agents",
            trendName: "AI Agents",
            read: false,
          },
        ],
      }),
      mutateAlerts: async () => ({ ok: true }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    unreadOnly: true,
    alerts: [
      {
        id: 1,
        trendId: "ai-agents",
        trendName: "AI Agents",
        read: false,
      },
    ],
  });
});

test("alerts POST route returns mark-read results from the fallback service", async () => {
  const response = await handleAlertsPost(
    new Request("http://localhost/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark-read", eventIds: [1, 2] }),
    }),
    {
      listAlerts: async () => ({ alerts: [] }),
      mutateAlerts: async (body) => ({
        updated: "action" in body ? body.eventIds.length : 0,
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { updated: 2 });
});
