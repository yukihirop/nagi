import { describe, expect, it } from "vitest";
import { computeNextRun } from "../index.js";
import type { ScheduledTask } from "@nagi/types";

function makeTask(
  overrides: Partial<ScheduledTask> = {},
): ScheduledTask {
  return {
    id: "task-1",
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
    ...overrides,
  };
}

describe("computeNextRun", () => {
  it("returns null for once tasks", () => {
    const task = makeTask({ schedule_type: "once" });
    expect(computeNextRun(task, "UTC")).toBeNull();
  });

  it("computes next cron run", () => {
    const task = makeTask({
      schedule_type: "cron",
      schedule_value: "0 9 * * *",
    });
    const next = computeNextRun(task, "UTC");
    expect(next).toBeTruthy();
    expect(new Date(next!).getUTCHours()).toBe(9);
    expect(new Date(next!).getUTCMinutes()).toBe(0);
  });

  it("computes next interval run anchored to scheduled time", () => {
    const baseTime = new Date("2026-01-15T10:00:00Z").getTime();
    const task = makeTask({
      schedule_type: "interval",
      schedule_value: "3600000", // 1 hour
      next_run: new Date(baseTime).toISOString(),
    });
    const next = computeNextRun(task, "UTC");
    expect(next).toBeTruthy();
    // Should be in the future, anchored to the original schedule
    expect(new Date(next!).getTime()).toBeGreaterThan(Date.now());
  });

  it("skips past missed intervals", () => {
    // Set next_run far in the past
    const pastTime = new Date("2020-01-01T00:00:00Z").toISOString();
    const task = makeTask({
      schedule_type: "interval",
      schedule_value: "60000", // 1 minute
      next_run: pastTime,
    });
    const next = computeNextRun(task, "UTC");
    expect(next).toBeTruthy();
    expect(new Date(next!).getTime()).toBeGreaterThan(Date.now());
  });

  it("handles invalid interval value gracefully", () => {
    const task = makeTask({
      schedule_type: "interval",
      schedule_value: "invalid",
      next_run: new Date().toISOString(),
    });
    const next = computeNextRun(task, "UTC");
    expect(next).toBeTruthy();
    // Should return ~1 minute from now as fallback
    expect(new Date(next!).getTime()).toBeGreaterThan(Date.now());
  });

  it("returns null for unknown schedule type", () => {
    const task = makeTask({
      schedule_type: "unknown" as "cron",
    });
    expect(computeNextRun(task, "UTC")).toBeNull();
  });
});
