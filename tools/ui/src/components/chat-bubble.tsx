import type { ChatMessage } from "../types.ts";

function formatTime(ts: string): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.type === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-xl px-3 py-2 ${
          isUser
            ? "bg-indigo-500 text-white rounded-br-sm"
            : "border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 rounded-bl-sm"
        }`}
      >
        {msg.toolUses && msg.toolUses.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {msg.toolUses.map((t, i) => (
              <span key={i} className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {t.name}
              </span>
            ))}
          </div>
        )}
        {msg.content && <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>}
        <div className={`mt-1 text-right text-[10px] ${isUser ? "text-white/70" : "text-zinc-400"}`}>
          {formatTime(msg.timestamp)}
        </div>
      </div>
    </div>
  );
}
