import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { api } from "../api.ts";
import { ChatBubble } from "../components/chat-bubble.tsx";
import type { ChatMessage, ThreadSummary } from "../types.ts";

export function ThreadDetail() {
  const { id, threadIndex } = useParams<{ id: string; threadIndex: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadCount, setThreadCount] = useState<number | null>(null);

  useEffect(() => {
    if (!id || threadIndex === undefined) return;
    api.sessionThreadMessages(id, parseInt(threadIndex, 10)).then((msgs) => {
      if (msgs) setMessages(msgs);
    });
    api.sessionThreads(id).then((threads: ThreadSummary[] | null) => {
      if (threads) setThreadCount(threads.length);
    });
  }, [id, threadIndex]);

  const idx = Number(threadIndex) + 1;

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => navigate(`/sessions/${id}`)}
          className="rounded border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          &larr; Threads
        </button>
        <span className="text-sm text-zinc-500">
          Thread #{idx}
          {threadCount !== null && (
            <span className="text-zinc-400"> of {threadCount}</span>
          )}
        </span>
      </div>
      <div className="flex flex-col gap-2 w-full">
        {messages.map((msg) => (
          <ChatBubble key={msg.uuid} msg={msg} />
        ))}
        {messages.length === 0 && (
          <div className="p-8 text-center text-zinc-400">
            No messages in this thread
          </div>
        )}
      </div>
    </>
  );
}
