import { ChatBubble } from "../components/chat-bubble.tsx";
import type { SessionInfo, ChatMessage } from "../types.ts";

export function Sessions({
  sessions,
  activeSessionId,
  messages,
  onSelect,
  onBack,
}: {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  if (activeSessionId) {
    return (
      <>
        <div className="mb-3 flex items-center gap-2">
          <button onClick={onBack} className="rounded border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            &larr; Back
          </button>
          <span className="text-sm text-zinc-500">
            Session: <code>{activeSessionId.slice(0, 8)}...</code>
          </span>
        </div>
        <div className="flex flex-col gap-2 w-full">
          {messages.map((msg) => (
            <ChatBubble key={msg.uuid} msg={msg} />
          ))}
          {messages.length === 0 && (
            <div className="p-8 text-center text-zinc-400">No messages in this session</div>
          )}
        </div>
      </>
    );
  }

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
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500"></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.sessionId} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
              <td className="px-4 py-2"><span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">{s.groupFolder}</span></td>
              <td className="px-4 py-2"><code className="text-xs">{s.sessionId.slice(0, 8)}...</code></td>
              <td className="px-4 py-2 text-zinc-500">{s.startedAt ? new Date(s.startedAt).toLocaleString() : "—"}</td>
              <td className="px-4 py-2">
                <button onClick={() => onSelect(s.sessionId)} className="rounded border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
