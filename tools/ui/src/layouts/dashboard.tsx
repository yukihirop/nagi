import { useState } from "react";
import { Outlet, useLocation } from "react-router";
import { NavSidebar } from "../components/nav-sidebar.tsx";
import { useData } from "../contexts/data-context.tsx";

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/groups": "Groups",
  "/channels": "Channels",
  "/sessions": "Sessions",
  "/tasks": "Tasks",
  "/logs": "Logs",
  "/settings": "Settings",
};

function getTitle(pathname: string): string {
  if (pathname.startsWith("/sessions/")) return "Sessions";
  return TITLES[pathname] ?? "Nagi";
}

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const { themeMode, cycleTheme } = useData();

  const title = getTitle(location.pathname);

  return (
    <div className="flex h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <NavSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-zinc-50 px-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-base font-semibold">{title}</h1>
          <button
            onClick={cycleTheme}
            className="rounded p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            title="Toggle theme"
          >
            {themeMode === "dark" || (themeMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
              ? "\u2600\uFE0F"
              : "\uD83C\uDF19"}
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
