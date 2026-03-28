import { useSearchParams } from "react-router";
import { useData } from "../contexts/data-context.tsx";
import type { LogEntry, LogFilter, ContainerLog, TaskRunLog } from "../types.ts";

const FILTERS: { value: LogFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "container", label: "Container" },
  { value: "task", label: "Task" },
];

function ContainerLogRow({ log }: { log: ContainerLog }) {
  const exitOk = log.exitCode === "0";
  return (
    <details className="border-b border-zinc-100 dark:border-zinc-800">
      <summary className="cursor-pointer flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-sm">
        <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${
          exitOk
            ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
            : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
        }`}>
          exit {log.exitCode}
        </span>
        <span className="shrink-0 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          {log.group}
        </span>
        <span className="text-zinc-500 text-xs">{log.duration}</span>
        <span className="ml-auto text-zinc-400 text-xs">{new Date(log.timestamp).toLocaleString()}</span>
      </summary>
      <pre className="mx-4 mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 whitespace-pre-wrap max-h-96 overflow-y-auto">
        {log.content}
      </pre>
    </details>
  );
}

function TaskLogRow({ log }: { log: TaskRunLog }) {
  const ok = log.status === "success";
  return (
    <details className="border-b border-zinc-100 dark:border-zinc-800">
      <summary className="cursor-pointer flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-sm">
        <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${
          ok
            ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
            : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
        }`}>
          {log.status}
        </span>
        <span className="text-zinc-500 text-xs">Task: {log.taskId.slice(0, 8)}...</span>
        <span className="text-zinc-500 text-xs">{log.durationMs}ms</span>
        <span className="ml-auto text-zinc-400 text-xs">{new Date(log.runAt).toLocaleString()}</span>
      </summary>
      <div className="mx-4 mb-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900">
        {log.result && <div className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{log.result}</div>}
        {log.error && <div className="text-red-600 dark:text-red-400 whitespace-pre-wrap">{log.error}</div>}
        {!log.result && !log.error && <div className="text-zinc-400">No output</div>}
      </div>
    </details>
  );
}

export function Logs() {
  const { logs: allLogs, fetchLogs } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get("filter") as LogFilter) || "all";

  const handleFilterChange = async (f: LogFilter) => {
    setSearchParams(f === "all" ? {} : { filter: f });
    await fetchLogs(f);
  };

  const logs: LogEntry[] = allLogs;

  return (
    <>
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-indigo-500 text-white"
                : "border border-zinc-200 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
          No logs available
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
          {logs.map((log, i) =>
            log.type === "container"
              ? <ContainerLogRow key={`c-${i}`} log={log} />
              : <TaskLogRow key={`t-${i}`} log={log} />,
          )}
        </div>
      )}
    </>
  );
}
