import assert from "node:assert/strict";
import test from "node:test";

import {
  handleNotificationChannelDelete,
} from "@/app/api/notifications/channels/[channelId]/route";
import {
  handleNotificationChannelTestPost,
} from "@/app/api/notifications/channels/[channelId]/test/route";
import {
  handleNotificationChannelsGet,
  handleNotificationChannelsPost,
} from "@/app/api/notifications/channels/route";

test("notification channels GET returns fallback channels", async () => {
  const response = await handleNotificationChannelsGet(
    new Request("http://localhost/api/notifications/channels"),
    {
      listNotificationChannels: async () => ({
        channels: [{ id: 1, destination: "https://hooks.example.test/abc" }],
      }),
      createNotificationChannel: async () => ({}),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    channels: [{ id: 1, destination: "https://hooks.example.test/abc" }],
  });
});

test("notification channels POST creates a channel", async () => {
  const response = await handleNotificationChannelsPost(
    new Request("http://localhost/api/notifications/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: "https://hooks.example.test/abc", label: "Ops" }),
    }),
    {
      listNotificationChannels: async () => ({ channels: [] }),
      createNotificationChannel: async (destination, label) => ({ id: 2, destination, label }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    id: 2,
    destination: "https://hooks.example.test/abc",
    label: "Ops",
  });
});

test("notification channel DELETE returns the delete payload", async () => {
  const response = await handleNotificationChannelDelete(
    new Request("http://localhost/api/notifications/channels/4", { method: "DELETE" }),
    { params: Promise.resolve({ channelId: "4" }) },
    {
      deleteNotificationChannel: async (channelId) => ({ ok: channelId === 4 }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("notification channel test POST returns the probe result", async () => {
  const response = await handleNotificationChannelTestPost(
    new Request("http://localhost/api/notifications/channels/4/test", { method: "POST" }),
    { params: Promise.resolve({ channelId: "4" }) },
    {
      testNotificationChannel: async (channelId) => ({ ok: channelId === 4, statusCode: 204 }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, statusCode: 204 });
});
