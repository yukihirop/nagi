import { useData } from "../contexts/data-context.tsx";

export function Tasks() {
  const { tasks } = useData();

  if (tasks.length === 0) {
    return <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">No scheduled tasks</div>;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Prompt</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Schedule</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Next Run</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Last Run</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
              <td className="max-w-[300px] truncate px-4 py-2">{t.prompt}</td>
              <td className="px-4 py-2"><code className="text-xs">{t.schedule_value}</code> ({t.schedule_type})</td>
              <td className="px-4 py-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                  t.status === "active" ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                  : t.status === "paused" ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                  : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                }`}>{t.status}</span>
              </td>
              <td className="px-4 py-2 text-zinc-500">{t.next_run ? new Date(t.next_run).toLocaleString() : "—"}</td>
              <td className="px-4 py-2 text-zinc-500">{t.last_run ? new Date(t.last_run).toLocaleString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
