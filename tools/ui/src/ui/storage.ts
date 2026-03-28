import { getSafeLocalStorage } from "../local-storage.ts";
import { parseThemeMode, type ThemeMode } from "./theme.ts";

const SETTINGS_KEY = "nagi.ui.settings.v1";

export type UiSettings = {
  themeMode: ThemeMode;
  navCollapsed: boolean;
};

export function loadSettings(): UiSettings {
  const defaults: UiSettings = {
    themeMode: "system",
    navCollapsed: false,
  };

  try {
    const storage = getSafeLocalStorage();
    const raw = storage?.getItem(SETTINGS_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      themeMode: parseThemeMode(parsed.themeMode),
      navCollapsed:
        typeof parsed.navCollapsed === "boolean"
          ? parsed.navCollapsed
          : defaults.navCollapsed,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: UiSettings): void {
  try {
    const storage = getSafeLocalStorage();
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // best-effort
  }
}
