import { resolveTheme, type ThemeMode } from "./theme.ts";
import { pathForTab, tabFromPath, type Tab } from "./navigation.ts";
import { loadSettings, saveSettings } from "./storage.ts";
import type { NagiApp } from "./app.ts";

export function applySettings(app: NagiApp): void {
  const settings = loadSettings();
  app.themeMode = settings.themeMode;
  app.resolvedTheme = resolveTheme(settings.themeMode);
  applyThemeToDocument(app.resolvedTheme);

  const tab = tabFromPath(location.pathname);
  app.tab = tab ?? "overview";
}

export function setTab(app: NagiApp, tab: Tab): void {
  if (app.tab === tab) return;
  app.tab = tab;
  const path = pathForTab(tab);
  history.pushState(null, "", path);
}

export function setThemeMode(app: NagiApp, mode: ThemeMode): void {
  app.themeMode = mode;
  app.resolvedTheme = resolveTheme(mode);
  applyThemeToDocument(app.resolvedTheme);
  saveSettings({ themeMode: mode, navCollapsed: false });
}

export function cycleTheme(app: NagiApp): void {
  const order: ThemeMode[] = ["system", "light", "dark"];
  const idx = order.indexOf(app.themeMode);
  const next = order[(idx + 1) % order.length];
  setThemeMode(app, next);
}

export function onPopState(app: NagiApp): void {
  const tab = tabFromPath(location.pathname);
  if (tab) {
    app.tab = tab;
  }
}

function applyThemeToDocument(theme: "light" | "dark"): void {
  document.documentElement.setAttribute("data-theme", theme);
}
