import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { api } from "../api.ts";
import { ChatBubble } from "../components/chat-bubble.tsx";
import type { ChatMessage } from "../types.ts";

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!id) return;
    api.sessionMessages(id).then((msgs) => {
      if (msgs) setMessages(msgs);
    });
  }, [id]);

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => navigate("/sessions")} className="rounded border border-zinc-200 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
          &larr; Back
        </button>
        <span className="text-sm text-zinc-500">
          Session: <code>{id?.slice(0, 8)}...</code>
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
