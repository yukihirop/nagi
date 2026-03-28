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

function toolSummary(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "Read":
    case "Write":
    case "Glob":
      return typeof input.file_path === "string" ? input.file_path : typeof input.pattern === "string" ? input.pattern : "";
    case "Edit":
      return typeof input.file_path === "string" ? input.file_path : "";
    case "Grep":
      return typeof input.pattern === "string" ? input.pattern : "";
    case "Bash":
      return typeof input.command === "string" ? (input.command.length > 60 ? input.command.slice(0, 60) + "..." : input.command) : "";
    case "Skill":
      return typeof input.skill === "string" ? input.skill : "";
    case "Agent":
      return typeof input.description === "string" ? input.description : "";
    case "WebSearch":
      return typeof input.query === "string" ? input.query : "";
    case "WebFetch":
      return typeof input.url === "string" ? input.url : "";
    default: {
      for (const key of ["file_path", "path", "command", "query", "name", "url"]) {
        if (typeof input[key] === "string") return input[key] as string;
      }
      return "";
    }
  }
}

function UserBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="flex flex-col gap-1 max-w-[75%] items-end">
        <span className="text-[10px] font-medium text-indigo-500">You</span>
        <div className="rounded-xl px-3 py-2 bg-indigo-500 text-white rounded-br-sm">
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
          <div className="mt-1 text-right text-[10px] text-white/70">{formatTime(msg.timestamp)}</div>
        </div>
      </div>
    </div>
  );
}

function TimelineStep({ icon, children, isLast }: { icon: string; children: React.ReactNode; isLast?: boolean }) {
  return (
    <div className="relative flex gap-3">
      {/* Vertical line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-zinc-200 dark:bg-zinc-700" />
      )}
      {/* Dot */}
      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs dark:bg-zinc-800">
        {icon}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">{children}</div>
    </div>
  );
}

function AssistantTimeline({ msg }: { msg: ChatMessage }) {
  const timelineSteps: Array<{ type: "thinking" | "tool"; key: string }> = [];

  if (msg.thinking) {
    timelineSteps.push({ type: "thinking", key: "thinking" });
  }
  if (msg.toolUses) {
    for (let i = 0; i < msg.toolUses.length; i++) {
      timelineSteps.push({ type: "tool", key: `tool-${i}` });
    }
  }

  const hasTimeline = timelineSteps.length > 0;

  return (
    <div>
      <span className="text-[10px] font-medium text-zinc-500 mb-1 block">Nagi</span>

      {/* Timeline for thinking + tools */}
      {hasTimeline && (
        <div className="ml-1 mb-3">
          {timelineSteps.map((step, idx) => {
            const isLast = idx === timelineSteps.length - 1;

            if (step.type === "thinking") {
              return (
                <TimelineStep key={step.key} icon="&#x1f4ad;" isLast={isLast}>
                  <details>
                    <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                      Thinking...
                    </summary>
                    <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {msg.thinking}
                    </div>
                  </details>
                </TimelineStep>
              );
            }

            const toolIdx = parseInt(step.key.split("-")[1]);
            const t = msg.toolUses![toolIdx];
            const summary = toolSummary(t.name, t.input);
            return (
              <TimelineStep key={step.key} icon="&#x1f527;" isLast={isLast}>
                <details>
                  <summary className="cursor-pointer flex items-center gap-2 text-sm">
                    <span className="inline-block shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      {t.name}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 truncate text-xs">
                      {summary}
                    </span>
                  </summary>
                  <pre className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {truncateInput(t.input)}
                  </pre>
                </details>
              </TimelineStep>
            );
          })}
        </div>
      )}

      {/* Text response as bubble */}
      {msg.content && (
        <div className="rounded-xl px-3 py-2 border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 rounded-bl-sm max-w-[75%]">
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
          <div className="mt-1 text-right text-[10px] text-zinc-400">{formatTime(msg.timestamp)}</div>
        </div>
      )}

      {!msg.content && (
        <div className="text-[10px] text-zinc-400 mt-1">{formatTime(msg.timestamp)}</div>
      )}
    </div>
  );
}

export function ChatBubble({ msg }: { msg: ChatMessage }) {
  if (msg.type === "user") {
    return <UserBubble msg={msg} />;
  }
  return <AssistantTimeline msg={msg} />;
}
