export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const VALID_THEME_MODES = new Set<ThemeMode>(["system", "light", "dark"]);

export function prefersLightScheme(): boolean {
  if (typeof globalThis.matchMedia !== "function") {
    return false;
  }
  return globalThis.matchMedia("(prefers-color-scheme: light)").matches;
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return prefersLightScheme() ? "light" : "dark";
  }
  return mode;
}

export function parseThemeMode(raw: unknown): ThemeMode {
  if (typeof raw === "string" && VALID_THEME_MODES.has(raw as ThemeMode)) {
    return raw as ThemeMode;
  }
  return "system";
}
