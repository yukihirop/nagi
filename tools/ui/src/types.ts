export type Tab = "overview" | "groups" | "channels" | "sessions" | "tasks" | "logs" | "settings";

export type GroupInfo = {
  name: string;
  folder: string;
  trigger: string;
  added_at: string;
  isMain?: boolean;
};

export type ChannelInfo = {
  jid: string;
  name: string;
  channel: string;
  last_message_time: string;
  is_group: number;
};

export type TaskInfo = {
  id: string;
  group_folder: string;
  chat_jid: string;
  prompt: string;
  schedule_type: string;
  schedule_value: string;
  status: string;
  next_run: string | null;
  last_run: string | null;
};

export type OverviewData = {
  groups: number;
  channels: number;
  tasks: number;
  activeTasks: number;
};

export type SessionInfo = {
  groupFolder: string;
  sessionId: string;
  startedAt: number;
  messageCount: number;
};

export type ChatMessage = {
  type: "user" | "assistant";
  content: string;
  timestamp: string;
  uuid: string;
  toolUses?: Array<{ name: string; input: Record<string, unknown> }>;
  thinking?: string;
};

export type ThemeMode = "light" | "dark" | "system";
