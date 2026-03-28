import { StatCard } from "../components/stat-card.tsx";
import type { Tab, OverviewData, SessionInfo, LogEntry } from "../types.ts";

export function Overview({ data, connected, sessions, logs, onNavigate }: { data: OverviewData | null; connected: boolean; sessions: SessionInfo[]; logs: LogEntry[]; onNavigate: (tab: Tab) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard title="Groups" value={data?.groups ?? 0} onClick={() => onNavigate("groups")} />
        <StatCard title="Channels" value={data?.channels ?? 0} onClick={() => onNavigate("channels")} />
        <StatCard title="Tasks" value={data?.tasks ?? 0} onClick={() => onNavigate("tasks")} />
        <StatCard title="Active Tasks" value={data?.activeTasks ?? 0} onClick={() => onNavigate("tasks")} />
        <StatCard title="Sessions" value={sessions.length} onClick={() => onNavigate("sessions")} />
        <StatCard title="Logs" value={logs.length} onClick={() => onNavigate("logs")} />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-base font-semibold">System Status</h2>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <span>Orchestrator</span>
            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${
              connected
                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
            }`}>
              <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
