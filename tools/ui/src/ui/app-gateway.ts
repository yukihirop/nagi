import type { NagiApp } from "./app.ts";

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function connectGateway(app: NagiApp): void {
  loadAll(app);
  pollTimer = setInterval(() => loadAll(app), 5000);
}

export function disconnectGateway(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function loadAll(app: NagiApp): Promise<void> {
  const [overview, groups, channels, tasks] = await Promise.all([
    fetchJson<{ groups: number; channels: number; tasks: number; activeTasks: number }>("/api/overview"),
    fetchJson<Record<string, { name: string; folder: string; trigger: string; added_at: string; isMain?: boolean }>>("/api/groups"),
    fetchJson<Array<{ jid: string; name: string; channel: string; last_message_time: string; is_group: number }>>("/api/channels"),
    fetchJson<Array<{ id: string; group_folder: string; chat_jid: string; prompt: string; schedule_type: string; schedule_value: string; status: string; next_run: string | null; last_run: string | null }>>("/api/tasks"),
  ]);

  if (overview) {
    app.groupCount = overview.groups;
    app.channelCount = overview.channels;
    app.queueDepth = 0;
    app.taskCount = overview.tasks;
    app.connected = true;
  } else {
    app.connected = false;
  }

  if (groups) app.groups = groups;
  if (channels) app.channels = channels;
  if (tasks) app.tasks = tasks;

  const sessions = await fetchJson<Array<{ groupFolder: string; sessionId: string; startedAt: number }>>("/api/sessions");
  if (sessions) app.sessions = sessions;
}

export async function loadSessionMessages(app: NagiApp, sessionId: string): Promise<void> {
  const messages = await fetchJson<Array<{ type: "user" | "assistant"; content: string; timestamp: string; uuid: string; toolUses?: Array<{ name: string }> }>>(`/api/sessions/${sessionId}/messages`);
  if (messages) app.sessionMessages = messages;
}
