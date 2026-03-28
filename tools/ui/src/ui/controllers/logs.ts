export type LogEntry = {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  source?: string;
};

export type LogsState = {
  entries: LogEntry[];
  loading: boolean;
};

export function initialLogsState(): LogsState {
  return { entries: [], loading: false };
}
