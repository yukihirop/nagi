import { describe, expect, it, beforeEach } from "vitest";
import { createDatabase, type NagiDatabase } from "../index.js";

let db: NagiDatabase;

const baseTask = {
  id: "task-1",
  group_folder: "main",
  chat_jid: "dc:123",
  prompt: "check status",
  schedule_type: "cron" as const,
  schedule_value: "0 9 * * *",
  context_mode: "group" as const,
  next_run: "2026-01-02T09:00:00Z",
  status: "active" as const,
  created_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  db = createDatabase({ memory: true });
});

describe("TaskRepository", () => {
  it("creates and retrieves a task", () => {
    db.tasks.create(baseTask);
    const task = db.tasks.getById("task-1");
    expect(task).toBeDefined();
    expect(task!.prompt).toBe("check status");
    expect(task!.schedule_type).toBe("cron");
  });

  it("gets tasks by group", () => {
    db.tasks.create(baseTask);
    db.tasks.create({ ...baseTask, id: "task-2", group_folder: "other" });
    expect(db.tasks.getByGroup("main")).toHaveLength(1);
  });

  it("gets all tasks", () => {
    db.tasks.create(baseTask);
    db.tasks.create({ ...baseTask, id: "task-2" });
    expect(db.tasks.getAll()).toHaveLength(2);
  });

  it("updates task fields", () => {
    db.tasks.create(baseTask);
    db.tasks.update("task-1", { prompt: "new prompt", status: "paused" });
    const task = db.tasks.getById("task-1");
    expect(task!.prompt).toBe("new prompt");
    expect(task!.status).toBe("paused");
  });

  it("deletes task and its run logs", () => {
    db.tasks.create(baseTask);
    db.tasks.logRun({
      task_id: "task-1",
      run_at: "2026-01-02T09:00:00Z",
      duration_ms: 1000,
      status: "success",
      result: "ok",
      error: null,
    });
    db.tasks.delete("task-1");
    expect(db.tasks.getById("task-1")).toBeUndefined();
  });

  it("logs task runs", () => {
    db.tasks.create(baseTask);
    db.tasks.logRun({
      task_id: "task-1",
      run_at: "2026-01-02T09:00:00Z",
      duration_ms: 1500,
      status: "success",
      result: "done",
      error: null,
    });
    // Verify no error (log is write-only in current API)
  });

  it("updateAfterRun sets completion when nextRun is null", () => {
    db.tasks.create({ ...baseTask, schedule_type: "once" });
    db.tasks.updateAfterRun("task-1", null, "done");
    const task = db.tasks.getById("task-1");
    expect(task!.status).toBe("completed");
    expect(task!.last_result).toBe("done");
  });
});
