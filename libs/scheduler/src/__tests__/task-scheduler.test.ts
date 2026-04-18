import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TaskScheduler } from "../index.js";
import type { ScheduledTask } from "@nagi/types";
import type { TaskRepo, TaskQueue } from "../task-scheduler.js";

function makeTask(id: string): ScheduledTask {
  return {
    id,
    group_folder: "main",
    chat_jid: "discord:123",
    prompt: "test",
    schedule_type: "cron",
    schedule_value: "0 9 * * *",
    context_mode: "group",
    next_run: "2026-01-15T09:00:00Z",
    last_run: null,
    last_result: null,
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("TaskScheduler", () => {
  let scheduler: TaskScheduler;

  afterEach(() => {
    scheduler?.stop();
  });

  it("polls due tasks and enqueues them", async () => {
    const task = makeTask("task-1");
    const taskRepo: TaskRepo = {
      getDue: vi.fn().mockReturnValue([task]),
      getById: vi.fn().mockReturnValue(task),
    };
    const queue: TaskQueue = {
      enqueueTask: vi.fn(),
    };
    const executor = vi.fn().mockResolvedValue(undefined);

    scheduler = new TaskScheduler({
      pollInterval: 100000,
      taskRepo,
      queue,
      executor,
    });

    scheduler.start();

    await vi.waitFor(() => {
      expect(queue.enqueueTask).toHaveBeenCalledWith(
        "discord:123",
        "task-1",
        expect.any(Function),
      );
    });
  });

  it("skips inactive tasks", async () => {
    const task = makeTask("task-1");
    const pausedTask = { ...task, status: "paused" as const };
    const taskRepo: TaskRepo = {
      getDue: vi.fn().mockReturnValue([task]),
      getById: vi.fn().mockReturnValue(pausedTask),
    };
    const queue: TaskQueue = {
      enqueueTask: vi.fn(),
    };

    scheduler = new TaskScheduler({
      pollInterval: 100000,
      taskRepo,
      queue,
      executor: vi.fn(),
    });

    scheduler.start();

    // Give it time to poll
    await new Promise((r) => setTimeout(r, 50));
    expect(queue.enqueueTask).not.toHaveBeenCalled();
  });

  it("does not start twice", () => {
    const taskRepo: TaskRepo = {
      getDue: vi.fn().mockReturnValue([]),
      getById: vi.fn(),
    };

    scheduler = new TaskScheduler({
      pollInterval: 100000,
      taskRepo,
      queue: { enqueueTask: vi.fn() },
      executor: vi.fn(),
    });

    scheduler.start();
    scheduler.start(); // should be a no-op

    // getDue should only be called once (from first start)
    expect(taskRepo.getDue).toHaveBeenCalledTimes(1);
  });

  it("stops polling after stop()", async () => {
    const taskRepo: TaskRepo = {
      getDue: vi.fn().mockReturnValue([]),
      getById: vi.fn(),
    };

    scheduler = new TaskScheduler({
      pollInterval: 10, // very short for test
      taskRepo,
      queue: { enqueueTask: vi.fn() },
      executor: vi.fn(),
    });

    scheduler.start();
    await new Promise((r) => setTimeout(r, 30));
    const callCount = (taskRepo.getDue as ReturnType<typeof vi.fn>).mock.calls
      .length;
    scheduler.stop();
    await new Promise((r) => setTimeout(r, 50));
    // Should not have been called many more times after stop
    expect(
      (taskRepo.getDue as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeLessThanOrEqual(callCount + 1);
  });
});
