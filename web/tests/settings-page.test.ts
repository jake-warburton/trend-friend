import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import SettingsPage from "@/app/settings/page";

test("settings page renders the scaffold for future settings sections", () => {
  const html = renderToStaticMarkup(SettingsPage());

  assert.match(html, /<h1>Settings<\/h1>/);
  assert.match(html, /Back to explorer/);
  assert.match(html, /Workspace/);
  assert.match(html, /Notifications/);
  assert.match(html, /Display/);
  assert.match(html, /Data/);
});
