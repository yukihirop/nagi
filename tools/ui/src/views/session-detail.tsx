import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { api } from "../api.ts";
import type { ThreadSummary } from "../types.ts";

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);

  useEffect(() => {
    if (!id) return;
    api.sessionThreads(id).then((t) => {
      if (t) setThreads(t);
    });
  }, [id]);

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => navigate("/sessions")}
          className="rounded border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          &larr; Back
        </button>
        <span className="text-sm text-zinc-500">
          Session: <code>{id?.slice(0, 8)}...</code>
        </span>
        <span className="text-sm text-zinc-400">
          ({threads.length} thread{threads.length !== 1 ? "s" : ""})
        </span>
      </div>
      <div className="flex flex-col gap-2 w-full">
        {threads.map((thread) => (
          <button
            key={thread.index}
            onClick={() => navigate(`/sessions/${id}/threads/${thread.index}`)}
            className="w-full text-left rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {thread.firstUserMessage}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {thread.messageCount} message{thread.messageCount !== 1 ? "s" : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs text-zinc-400">
                {new Date(thread.timestamp).toLocaleString()}
              </span>
            </div>
          </button>
        ))}
        {threads.length === 0 && (
          <div className="p-8 text-center text-zinc-400">
            No threads in this session
          </div>
        )}
      </div>
    </>
  );
}
