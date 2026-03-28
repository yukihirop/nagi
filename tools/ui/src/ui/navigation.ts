import type { IconName } from "./icons.ts";

export const TAB_GROUPS = [
  { label: "monitor", tabs: ["overview", "groups", "channels"] },
  { label: "agent", tabs: ["sessions"] },
  { label: "automation", tabs: ["tasks"] },
  { label: "system", tabs: ["logs", "settings"] },
] as const;

export type Tab =
  | "overview"
  | "groups"
  | "channels"
  | "sessions"
  | "tasks"
  | "logs"
  | "settings";

const TAB_PATHS: Record<Tab, string> = {
  overview: "/overview",
  groups: "/groups",
  channels: "/channels",
  sessions: "/sessions",
  tasks: "/tasks",
  logs: "/logs",
  settings: "/settings",
};

const PATH_TO_TAB = new Map(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab]),
);

export function pathForTab(tab: Tab): string {
  return TAB_PATHS[tab];
}

export function tabFromPath(pathname: string): Tab | null {
  let normalized = pathname || "/";
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  normalized = normalized.toLowerCase();
  if (normalized === "/" || normalized === "/index.html") {
    return "overview";
  }
  return PATH_TO_TAB.get(normalized) ?? null;
}

export function iconForTab(tab: Tab): IconName {
  switch (tab) {
    case "overview":
      return "barChart";
    case "groups":
      return "folder";
    case "channels":
      return "link";
    case "sessions":
      return "monitor";
    case "tasks":
      return "loader";
    case "logs":
      return "scrollText";
    case "settings":
      return "settings";
    default:
      return "folder";
  }
}

export function titleForTab(tab: Tab): string {
  const titles: Record<Tab, string> = {
    overview: "Overview",
    groups: "Groups",
    channels: "Channels",
    sessions: "Sessions",
    tasks: "Tasks",
    logs: "Logs",
    settings: "Settings",
  };
  return titles[tab];
}
