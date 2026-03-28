import type { ChatMessage } from "../types.ts";

function formatTime(ts: string): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function truncateInput(input: Record<string, unknown>): string {
  const json = JSON.stringify(input, null, 2);
  if (json.length > 500) return json.slice(0, 500) + "\n...";
  return json;
}

export function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.type === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <span className={`text-[10px] font-medium ${isUser ? "text-indigo-500" : "text-zinc-500"}`}>
          {isUser ? "You" : "Nagi"}
        </span>
        <div
          className={`rounded-xl px-3 py-2 ${
            isUser
              ? "bg-indigo-500 text-white rounded-br-sm"
              : "border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 rounded-bl-sm"
          }`}
        >
          {msg.thinking && (
            <details className="mb-2">
              <summary className="cursor-pointer text-[11px] font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                Thinking...
              </summary>
              <div className="mt-1 rounded bg-zinc-100 p-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {msg.thinking}
              </div>
            </details>
          )}

          {msg.toolUses && msg.toolUses.length > 0 && (
            <div className="flex flex-col gap-1 mb-2">
              {msg.toolUses.map((t, i) => (
                <details key={i} className="rounded bg-zinc-100 dark:bg-zinc-900">
                  <summary className="cursor-pointer flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded">
                    <span className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] dark:bg-blue-900">
                      {t.name}
                    </span>
                    <span className="text-zinc-400">params</span>
                  </summary>
                  <pre className="px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {truncateInput(t.input)}
                  </pre>
                </details>
              ))}
            </div>
          )}

          {msg.content && <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>}

          <div className={`mt-1 text-right text-[10px] ${isUser ? "text-white/70" : "text-zinc-400"}`}>
            {formatTime(msg.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
}
