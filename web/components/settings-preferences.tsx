"use client";

import { useEffect, useState } from "react";

import {
  getDefaultThemeForScheme,
  getThemeClass,
  readThemePreference,
  THEME_COOKIE,
  THEME_LOCAL_STORAGE_KEY,
  type ThemeOption,
} from "@/lib/settings";

type SettingsPreferencesProps = {
  initialTheme: string;
  themes: readonly ThemeOption[];
};

export function SettingsPreferences({
  initialTheme,
  themes,
}: SettingsPreferencesProps) {
  const [selectedTheme, setSelectedTheme] = useState(initialTheme);

  useEffect(() => {
    const lsTheme = readThemePreference(localStorage.getItem(THEME_LOCAL_STORAGE_KEY) ?? undefined);
    if (lsTheme) {
      setSelectedTheme(lsTheme);
      return;
    }
    const cookieTheme = readThemePreference(
      document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(`${THEME_COOKIE}=`))
        ?.split("=")
        .slice(1)
        .join("="),
    );
    if (cookieTheme) {
      setSelectedTheme(cookieTheme);
      localStorage.setItem(THEME_LOCAL_STORAGE_KEY, cookieTheme);
      return;
    }
    const defaultTheme = getDefaultThemeForScheme(window.matchMedia("(prefers-color-scheme: dark)").matches);
    setSelectedTheme(defaultTheme);
    localStorage.setItem(THEME_LOCAL_STORAGE_KEY, defaultTheme);
  }, []);

  useEffect(() => {
    const nextThemeClass = getThemeClass(selectedTheme);
    const root = document.documentElement;
    for (const theme of themes) {
      root.classList.remove(theme.className);
    }
    root.classList.add(nextThemeClass);
  }, [selectedTheme, themes]);

  function updateThemePreference(nextTheme: string) {
    setSelectedTheme(nextTheme);
    localStorage.setItem(THEME_LOCAL_STORAGE_KEY, nextTheme);
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
    </div>
  );
}
