import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { api } from "../api.ts";
import { ChatBubble } from "../components/chat-bubble.tsx";
import type { ChatMessage } from "../types.ts";

export function ThreadDetail() {
  const { id, threadIndex } = useParams<{ id: string; threadIndex: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!id || threadIndex === undefined) return;
    api.sessionThreadMessages(id, parseInt(threadIndex, 10)).then((msgs) => {
      if (msgs) setMessages(msgs);
    });
  }, [id, threadIndex]);

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
          Thread #{Number(threadIndex) + 1}
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
