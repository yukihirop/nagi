import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../api.ts";
import type { ThemeMode, OverviewData, GroupInfo, ChannelInfo, TaskInfo, SessionInfo, LogEntry } from "../types.ts";

function applyTheme(mode: ThemeMode) {
  const isDark =
    mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
  localStorage.setItem("nagi.ui.theme", mode);
}

type DataContextValue = {
  connected: boolean;
  overview: OverviewData | null;
  groups: Record<string, GroupInfo>;
  channels: ChannelInfo[];
  tasks: TaskInfo[];
  sessions: SessionInfo[];
  logs: LogEntry[];
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  cycleTheme: () => void;
  fetchLogs: (filter?: string) => Promise<LogEntry[]>;
};

const DataContext = createContext<DataContextValue>(null!);

export function useData() {
  return useContext(DataContext);
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeRaw] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("nagi.ui.theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  });
  const [connected, setConnected] = useState(false);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [groups, setGroups] = useState<Record<string, GroupInfo>>({});
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

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

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeRaw(mode);
  }, []);

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  const cycleTheme = useCallback(() => {
    const order: ThemeMode[] = ["system", "light", "dark"];
    setThemeModeRaw((prev) => {
      const idx = order.indexOf(prev);
      return order[(idx + 1) % order.length];
    });
  }, []);

  const fetchLogs = useCallback(async (filter?: string): Promise<LogEntry[]> => {
    const lo = await api.logs(filter);
    if (lo) {
      setLogs(lo);
      return lo;
    }
    return logs;
  }, [logs]);

  return (
    <DataContext.Provider value={{ connected, overview, groups, channels, tasks, sessions, logs, themeMode, setThemeMode, cycleTheme, fetchLogs }}>
      {children}
    </DataContext.Provider>
  );
}
