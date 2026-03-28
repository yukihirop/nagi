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

function parseContainerLog(filename: string, raw: string): Omit<ContainerLog, "content"> & { content: string } {
  let timestamp = "";
  let group = "";
  let duration = "";
  let exitCode = "";
  let sessionId = "";

  for (const line of raw.split("\n").slice(0, 15)) {
    if (line.startsWith("Timestamp: ")) timestamp = line.slice(11).trim();
    else if (line.startsWith("Group: ")) group = line.slice(7).trim();
    else if (line.startsWith("Duration: ")) duration = line.slice(10).trim();
    else if (line.startsWith("Exit Code: ")) exitCode = line.slice(11).trim();
    else if (line.startsWith("Session ID: ")) sessionId = line.slice(12).trim();
  }

  return { type: "container", filename, timestamp, group, duration, exitCode, sessionId, content: raw };
}

export function handleLogs(
  dataDir: string,
  db: NagiDatabase,
  filter?: string,
): LogEntry[] {
  const logs: LogEntry[] = [];

  // Container logs
  if (!filter || filter === "container") {
    const groupsDir = path.join(dataDir, "groups");
    if (fs.existsSync(groupsDir)) {
      const groupFolders = fs.readdirSync(groupsDir).filter((f) => {
        try { return fs.statSync(path.join(groupsDir, f)).isDirectory(); } catch { return false; }
      });

      for (const groupFolder of groupFolders) {
        const logsDir = path.join(groupsDir, groupFolder, "logs");
        if (!fs.existsSync(logsDir)) continue;

        const logFiles = fs.readdirSync(logsDir)
          .filter((f) => f.startsWith("container-") && f.endsWith(".log"))
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
