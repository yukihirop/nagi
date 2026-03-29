import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { api } from "../api.ts";
import type { ThreadSummary } from "../types.ts";

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    api.sessionThreads(id).then((t) => {
      if (t) setThreads(t);
    });
  }, [id]);

  // Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setQuery("");
        inputRef.current?.blur();
      }
    },
    [],
  );

  const filtered = useMemo(
    () =>
      query
        ? threads.filter((t) =>
            t.firstUserMessage.toLowerCase().includes(query.toLowerCase()),
          )
        : threads,
    [threads, query],
  );

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

      {/* Search bar */}
      <div className="relative mb-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg
            className="h-4 w-4 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search threads..."
          className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-20 text-sm shadow-sm placeholder:text-zinc-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900 dark:placeholder:text-zinc-500 dark:focus:border-indigo-600 dark:focus:ring-indigo-900"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}K
          </kbd>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full">
        {filtered.map((thread) => (
          <button
            key={thread.index}
            onClick={() => navigate(`/sessions/${id}/threads/${thread.index}`)}
            className="w-full text-left rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  <HighlightMatch text={thread.firstUserMessage} query={query} />
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
        {threads.length > 0 && filtered.length === 0 && (
          <div className="p-8 text-center text-zinc-400">
            No matching threads
          </div>
        )}
        {threads.length === 0 && (
          <div className="p-8 text-center text-zinc-400">
            No threads in this session
          </div>
        )}
      </div>
    </>
  );
}
