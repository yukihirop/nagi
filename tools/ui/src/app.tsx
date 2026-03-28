import { useState, useEffect, useCallback } from "react";
import { api } from "./api.ts";
import { NavSidebar } from "./components/nav-sidebar.tsx";
import { Overview } from "./views/overview.tsx";
import { Groups } from "./views/groups.tsx";
import { Channels } from "./views/channels.tsx";
import { Sessions } from "./views/sessions.tsx";
import { Tasks } from "./views/tasks.tsx";
import { Logs } from "./views/logs.tsx";
import { Settings } from "./views/settings.tsx";
import type { Tab, ThemeMode, LogFilter, OverviewData, GroupInfo, ChannelInfo, TaskInfo, SessionInfo, ChatMessage, LogEntry } from "./types.ts";

function applyTheme(mode: ThemeMode) {
  const isDark =
    mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
  localStorage.setItem("nagi.ui.theme", mode);
}

const TITLES: Record<Tab, string> = {
  overview: "Overview",
  groups: "Groups",
  channels: "Channels",
  sessions: "Sessions",
  tasks: "Tasks",
  logs: "Logs",
  settings: "Settings",
};

export function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("nagi.ui.theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  });
  const [connected, setConnected] = useState(false);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [groups, setGroups] = useState<Record<string, GroupInfo>>({});
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");

  const loadAll = useCallback(async () => {
    const [ov, gr, ch, ta, se, lo] = await Promise.all([
      api.overview(),
      api.groups(),
      api.channels(),
      api.tasks(),
      api.sessions(),
      api.logs(),
    ]);
    setConnected(ov !== null);
    if (ov) setOverview(ov);
    if (gr) setGroups(gr);
    if (ch) setChannels(ch);
    if (ta) setTasks(ta);
    if (se) setSessions(se);
    if (lo) setLogs(lo);
  }, []);

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 5000);
    return () => clearInterval(timer);
  }, [loadAll]);

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  const handleSelectSession = async (id: string) => {
    setActiveSessionId(id);
    const msgs = await api.sessionMessages(id);
    if (msgs) setSessionMessages(msgs);
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const cycleTheme = () => {
    const order: ThemeMode[] = ["system", "light", "dark"];
    const idx = order.indexOf(themeMode);
    setThemeMode(order[(idx + 1) % order.length]);
  };

  const renderView = () => {
    switch (tab) {
      case "overview":
        return <Overview data={overview} connected={connected} sessions={sessions} logs={logs} onNavigate={setTab} />;
      case "groups":
        return <Groups groups={groups} />;
      case "channels":
        return <Channels channels={channels} />;
      case "sessions":
        return (
          <Sessions
            sessions={sessions}
            activeSessionId={activeSessionId}
            messages={sessionMessages}
            onSelect={handleSelectSession}
            onBack={() => { setActiveSessionId(null); setSessionMessages([]); }}
          />
        );
      case "tasks":
        return <Tasks tasks={tasks} />;
      case "logs":
        return <Logs logs={logs} filter={logFilter} onFilterChange={async (f) => {
          setLogFilter(f);
          const lo = await api.logs(f);
          if (lo) setLogs(lo);
        }} />;
      case "settings":
        return <Settings themeMode={themeMode} onThemeChange={handleThemeChange} />;
    }
  };

  return (
    <div className="flex h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <NavSidebar tab={tab} onTabChange={setTab} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-zinc-50 px-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-base font-semibold">{TITLES[tab]}</h1>
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
          {renderView()}
        </div>
      </main>
    </div>
  );
}
