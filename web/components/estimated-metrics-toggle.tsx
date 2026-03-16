"use client";

import { useState } from "react";
import { ESTIMATED_METRICS_COOKIE } from "@/lib/settings";

export function EstimatedMetricsToggle({ initialValue }: { initialValue: boolean }) {
  const [enabled, setEnabled] = useState(initialValue);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    document.cookie = `${ESTIMATED_METRICS_COOKIE}=${next ? "true" : "false"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="settings-toggle-row">
      <div>
        <p className="settings-copy">
          Show or hide estimated market-footprint values when a live provider is not configured.
          This preference is stored in the browser and affects trend detail pages.
        </p>
      </div>
      <button
        className={enabled ? "toggle-chip toggle-chip-active" : "toggle-chip"}
        onClick={toggle}
        type="button"
      >
        {enabled ? "Shown in UI" : "Hidden in UI"}
      </button>
    </div>
  );
}
