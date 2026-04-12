import fs from "node:fs";
import path from "node:path";
import type { NagiDatabase } from "@nagi/db";

export interface ContainerLog {
  type: "container";
  filename: string;
  timestamp: string;
  group: string;
  duration: string;
  exitCode: string;
  sessionId: string;
  content: string;
}

export interface TaskRunLog {
  type: "task";
  taskId: string;
  runAt: string;
  durationMs: number;
  status: string;
  result: string | null;
  error: string | null;
}

export type LogEntry = ContainerLog | TaskRunLog;

function parseContainerLog(filename: string, raw: string): ContainerLog {
  const data = JSON.parse(raw) as Record<string, unknown>;

  return {
    type: "container",
    filename,
    timestamp: String(data.timestamp ?? ""),
    group: String(data.group ?? ""),
    duration: `${data.duration ?? 0}ms`,
    exitCode: String(data.exitCode ?? ""),
    sessionId: String(data.sessionId ?? ""),
    content: raw,
  };
}

export function handleLogs(
  dataDir: string,
  db: NagiDatabase,
  filter?: string,
): LogEntry[] {
  const logs: LogEntry[] = [];

  // Container logs - scan 2 levels: __data/groups/{channel}/{folder}/logs/
  if (!filter || filter === "container") {
    const groupsDir = path.join(dataDir, "groups");
    if (fs.existsSync(groupsDir)) {
      const channelDirs = fs.readdirSync(groupsDir).filter((f) => {
        try { return fs.statSync(path.join(groupsDir, f)).isDirectory(); } catch { return false; }
      });

      for (const channel of channelDirs) {
        const channelDir = path.join(groupsDir, channel);
        const folderDirs = fs.readdirSync(channelDir).filter((f) => {
          try { return fs.statSync(path.join(channelDir, f)).isDirectory(); } catch { return false; }
        });

        for (const folder of folderDirs) {
          const logsDir = path.join(channelDir, folder, "logs");
          if (!fs.existsSync(logsDir)) continue;

          const logFiles = fs.readdirSync(logsDir)
            .filter((f) => f.startsWith("container-") && f.endsWith(".json"))
            .sort()
            .reverse();

          for (const logFile of logFiles) {
            try {
              const raw = fs.readFileSync(path.join(logsDir, logFile), "utf-8");
              logs.push(parseContainerLog(logFile, raw));
            } catch {
              // skip
            }
          }
        }
      }
    }
  }

  // Task run logs
  if (!filter || filter === "task") {
    const stmt = db.raw.prepare(
      "SELECT task_id, run_at, duration_ms, status, result, error FROM task_run_logs ORDER BY run_at DESC LIMIT 100",
    );
    const rows = stmt.all() as Array<{
      task_id: string;
      run_at: string;
      duration_ms: number;
      status: string;
      result: string | null;
      error: string | null;
    }>;

    for (const row of rows) {
      logs.push({
        type: "task",
        taskId: row.task_id,
        runAt: row.run_at,
        durationMs: row.duration_ms,
        status: row.status,
        result: row.result,
        error: row.error,
      });
    }
  }

  // Sort all by timestamp descending
  logs.sort((a, b) => {
    const tsA = a.type === "container" ? a.timestamp : a.runAt;
    const tsB = b.type === "container" ? b.timestamp : b.runAt;
    return tsB.localeCompare(tsA);
  });

  return logs;
}
