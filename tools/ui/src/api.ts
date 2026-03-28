import type { OverviewData, GroupInfo, ChannelInfo, TaskInfo, SessionInfo, ChatMessage } from "./types.ts";

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  overview: () => fetchJson<OverviewData>("/api/overview"),
  groups: () => fetchJson<Record<string, GroupInfo>>("/api/groups"),
  channels: () => fetchJson<ChannelInfo[]>("/api/channels"),
  tasks: () => fetchJson<TaskInfo[]>("/api/tasks"),
  sessions: () => fetchJson<SessionInfo[]>("/api/sessions"),
  sessionMessages: (id: string) => fetchJson<ChatMessage[]>(`/api/sessions/${id}/messages`),
};
