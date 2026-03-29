import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useData } from "../contexts/data-context.tsx";
import { api } from "../api.ts";

function ThreadCount({ sessionId }: { sessionId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    api.sessionThreads(sessionId).then((threads) => {
      if (threads) setCount(threads.length);
    });
  }, [sessionId]);

  if (count === null) return <span className="text-zinc-300 dark:text-zinc-600">-</span>;
  return <>{count}</>;
}

export function Sessions() {
  const { sessions } = useData();
  const navigate = useNavigate();

  if (sessions.length === 0) {
    return <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">No sessions found</div>;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Group</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Session ID</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Started</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Threads</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Messages</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.sessionId} onClick={() => navigate(`/sessions/${s.sessionId}`)} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 cursor-pointer">
              <td className="px-4 py-2"><span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">{s.groupFolder}</span></td>
              <td className="px-4 py-2"><code className="text-xs">{s.sessionId.slice(0, 8)}...</code></td>
              <td className="px-4 py-2 text-zinc-500">{s.startedAt ? new Date(s.startedAt).toLocaleString() : "—"}</td>
              <td className="px-4 py-2 text-right text-zinc-500"><ThreadCount sessionId={s.sessionId} /></td>
              <td className="px-4 py-2 text-right text-zinc-500">{s.messageCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
