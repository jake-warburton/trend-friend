"use client";

import { useState } from "react";

import { ESTIMATED_METRICS_COOKIE } from "@/lib/settings";

type SettingsPreferencesProps = {
  initialShowEstimatedMetrics: boolean;
};

export function SettingsPreferences({ initialShowEstimatedMetrics }: SettingsPreferencesProps) {
  const [showEstimatedMetrics, setShowEstimatedMetrics] = useState(initialShowEstimatedMetrics);

  function updateEstimatedMetricsPreference(nextValue: boolean) {
    setShowEstimatedMetrics(nextValue);
    document.cookie = `${ESTIMATED_METRICS_COOKIE}=${nextValue ? "true" : "false"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="settings-preferences-stack">
      <div className="settings-toggle-row">
        <div>
          <p className="eyebrow">Preference</p>
          <h2>Estimated market metrics</h2>
          <p className="settings-copy">
            Show or hide estimated market-footprint values when a live provider is not configured.
          </p>
        </div>
        <button
          className={showEstimatedMetrics ? "toggle-chip toggle-chip-active" : "toggle-chip"}
          onClick={() => updateEstimatedMetricsPreference(!showEstimatedMetrics)}
          type="button"
        >
          {showEstimatedMetrics ? "Shown in UI" : "Hidden in UI"}
        </button>
      </div>
      <p className="settings-copy">
        This preference is stored in your browser and immediately affects the market-footprint section on trend detail
        pages.
      </p>
    </div>
  );
}
