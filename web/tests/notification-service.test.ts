import assert from "node:assert/strict";
import test from "node:test";

import {
  createNotificationChannel,
  deleteNotificationChannel,
  listNotificationChannels,
  testNotificationChannel,
} from "@/lib/server/notification-service";

test("listNotificationChannels uses the CLI fallback when API mode is disabled", async () => {
  const payload = await listNotificationChannels({
    apiEnabled: false,
    runScript: async (...args) => ({ args }),
  });

  assert.deepEqual(payload, { args: ["list-notification-channels"] });
});

test("createNotificationChannel maps to the CLI fallback", async () => {
  const payload = await createNotificationChannel("https://hooks.example.test/abc", "Team Hook", {
    apiEnabled: false,
    runScript: async (...args) => ({ args }),
  });

  assert.deepEqual(payload, {
    args: [
      "create-notification-channel",
      "--destination",
      "https://hooks.example.test/abc",
      "--label",
      "Team Hook",
    ],
  });
});

test("deleteNotificationChannel maps to the CLI fallback", async () => {
  const payload = await deleteNotificationChannel(12, {
    apiEnabled: false,
    runScript: async (...args) => ({ args }),
  });

  assert.deepEqual(payload, {
    args: ["delete-notification-channel", "--channel-id", "12"],
  });
});

test("testNotificationChannel maps to the CLI fallback", async () => {
  const payload = await testNotificationChannel(12, {
    apiEnabled: false,
    runScript: async (...args) => ({ args }),
  });

  assert.deepEqual(payload, {
    args: ["test-notification-channel", "--channel-id", "12"],
  });
});
