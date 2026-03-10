import assert from "node:assert/strict";
import test from "node:test";

import { maskWebhookDestination, summarizeNotificationDelivery } from "@/lib/notification-ui";

test("summarizeNotificationDelivery formats success, failure, and empty states", () => {
  assert.equal(summarizeNotificationDelivery(undefined), "No deliveries yet");
  assert.equal(
    summarizeNotificationDelivery({
      id: 1,
      sentAt: "2026-03-10T12:00:00Z",
      statusCode: 204,
      error: null,
    }),
    "Delivered (204)",
  );
  assert.equal(
    summarizeNotificationDelivery({
      id: 2,
      sentAt: "2026-03-10T12:01:00Z",
      statusCode: null,
      error: "timeout",
    }),
    "Failed: timeout",
  );
});

test("maskWebhookDestination keeps a readable host and path tail", () => {
  assert.equal(
    maskWebhookDestination("https://hooks.slack.com/services/T000/B000/SECRET"),
    "hooks.slack.com/SECRET",
  );
  assert.equal(maskWebhookDestination("not a url"), "not a url");
});
