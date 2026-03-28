import type { NagiDatabase } from "@nagi/db";

export function handleTasks(db: NagiDatabase) {
  return db.tasks.getAll();
}

export function handleTaskLogs(db: NagiDatabase, taskId: string) {
  const stmt = db.raw.prepare(
    "SELECT * FROM task_run_logs WHERE task_id = ? ORDER BY run_at DESC LIMIT 50",
  );
  return stmt.all(taskId);
}
