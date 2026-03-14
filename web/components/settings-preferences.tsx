"use client";

import { useEffect, useState } from "react";

import {
  ESTIMATED_METRICS_COOKIE,
  getDefaultThemeForScheme,
  getThemeClass,
  readThemePreference,
  THEME_COOKIE,
  type ThemeOption,
} from "@/lib/settings";

type SettingsPreferencesProps = {
  initialShowEstimatedMetrics: boolean;
  initialTheme: string;
  themes: readonly ThemeOption[];
};

export function SettingsPreferences({
  initialShowEstimatedMetrics,
  initialTheme,
  themes,
}: SettingsPreferencesProps) {
  const [showEstimatedMetrics, setShowEstimatedMetrics] = useState(initialShowEstimatedMetrics);
  const [selectedTheme, setSelectedTheme] = useState(initialTheme);

  useEffect(() => {
    const storedTheme = readThemePreference(
      document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(`${THEME_COOKIE}=`))
        ?.split("=")
        .slice(1)
        .join("="),
    );
    if (storedTheme) {
      setSelectedTheme(storedTheme);
      return;
    }
    setSelectedTheme(getDefaultThemeForScheme(window.matchMedia("(prefers-color-scheme: dark)").matches));
  }, []);

  useEffect(() => {
    const nextThemeClass = getThemeClass(selectedTheme);
    const root = document.documentElement;
    for (const theme of themes) {
      root.classList.remove(theme.className);
    }
    root.classList.add(nextThemeClass);
  }, [selectedTheme, themes]);

  function updateEstimatedMetricsPreference(nextValue: boolean) {
    setShowEstimatedMetrics(nextValue);
    document.cookie = `${ESTIMATED_METRICS_COOKIE}=${nextValue ? "true" : "false"}; path=/; max-age=31536000; samesite=lax`;
  }

  function updateThemePreference(nextTheme: string) {
    setSelectedTheme(nextTheme);
    document.cookie = `${THEME_COOKIE}=${nextTheme}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="settings-preferences-stack">
      <div className="settings-theme-stack">
        <div>
          <p className="eyebrow">Theme</p>
          <h2>Interface theme</h2>
          <p className="settings-copy">Choose the palette used across the app.</p>
        </div>
        <div className="settings-theme-options" role="radiogroup" aria-label="Interface theme">
          {themes.map((theme) => {
            const checked = theme.key === selectedTheme;
            return (
              <button
                aria-checked={checked}
                className={checked ? "settings-theme-option settings-theme-option-active" : "settings-theme-option"}
                key={theme.key}
                onClick={() => updateThemePreference(theme.key)}
                role="radio"
                type="button"
              >
                <span className={checked ? "settings-theme-radio settings-theme-radio-active" : "settings-theme-radio"} />
                <span className="settings-theme-label">{theme.label}</span>
                <span className="settings-theme-swatches" aria-hidden="true">
                  {theme.swatches.map((color) => (
                    <span className="settings-theme-swatch" key={`${theme.key}-${color}`} style={{ backgroundColor: color }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
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
