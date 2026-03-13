import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import SettingsPage from "@/app/settings/page";
import {
  buildEnrichmentProviderStatuses,
  getDefaultThemeForScheme,
  getThemeClass,
  LIGHT_THEME,
  readEstimatedMetricsPreference,
  readThemePreference,
  THEME_OPTIONS,
} from "@/lib/settings";

test("settings page renders preferences and enrichment status sections", async () => {
  const html = renderToStaticMarkup(await SettingsPage());

  assert.match(html, /<h1>Settings<\/h1>/);
  assert.match(html, /Back to explorer/);
  assert.match(html, /UI preferences/);
  assert.match(html, /Interface theme/);
  assert.match(html, /Tech Light/);
  assert.match(html, /Soft Charcoal/);
  assert.match(html, /Ocean/);
  assert.match(html, /Estimated market metrics/);
  assert.match(html, /Enrichment status/);
  assert.match(html, /Google search provider/);
  assert.match(html, /YouTube API/);
  assert.match(html, /TikTok provider/);
});

test("buildEnrichmentProviderStatuses reflects configured and fallback providers", () => {
  const statuses = buildEnrichmentProviderStatuses({
    SIGNAL_EYE_MARKET_ENRICHMENT_ENABLED: "true",
    SIGNAL_EYE_GOOGLE_SEARCH_METRICS_URL: "https://example.com/google",
    YOUTUBE_API_KEY: "",
    SIGNAL_EYE_TIKTOK_METRICS_URL: "",
  });

  assert.equal(statuses[0].configured, true);
  assert.equal(statuses[1].configured, true);
  assert.equal(statuses[2].configured, false);
  assert.equal(statuses[3].configured, false);
});

test("readEstimatedMetricsPreference defaults on and honors explicit false", () => {
  assert.equal(readEstimatedMetricsPreference(undefined), true);
  assert.equal(readEstimatedMetricsPreference("true"), true);
  assert.equal(readEstimatedMetricsPreference("false"), false);
});

test("theme helpers default safely and resolve CSS classes", () => {
  assert.equal(readThemePreference(undefined), null);
  assert.equal(readThemePreference("ocean"), "ocean");
  assert.equal(readThemePreference("unknown"), null);
  assert.equal(getDefaultThemeForScheme(false), LIGHT_THEME);
  assert.equal(getDefaultThemeForScheme(true), "soft-charcoal");
  assert.equal(getThemeClass("soft-charcoal"), "theme-soft-charcoal");
  assert.equal(THEME_OPTIONS[0]?.label, "Tech Light");
  assert.equal(THEME_OPTIONS[1]?.key, "soft-charcoal");
  assert.equal(THEME_OPTIONS[2]?.key, "ocean");
  assert.equal(THEME_OPTIONS.length, 3);
});
