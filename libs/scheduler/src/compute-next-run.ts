import { CronExpressionParser } from "cron-parser";
import { createLogger } from "@nagi/logger";
import type { ScheduledTask } from "@nagi/types";

const logger = createLogger({ name: "scheduler" });

/**
 * Compute the next run time for a recurring task, anchored to the
 * task's scheduled time rather than Date.now() to prevent cumulative
 * drift on interval-based tasks.
 */
export function computeNextRun(
  task: ScheduledTask,
  timezone: string,
): string | null {
  if (task.schedule_type === "once") return null;

  const now = Date.now();

  if (task.schedule_type === "cron") {
    const interval = CronExpressionParser.parse(task.schedule_value, {
      tz: timezone,
    });
    return interval.next().toISOString();
  }

  if (task.schedule_type === "interval") {
    const ms = parseInt(task.schedule_value, 10);
    if (!ms || ms <= 0) {
      logger.warn(
        { taskId: task.id, value: task.schedule_value },
        "Invalid interval value",
      );
      return new Date(now + 60_000).toISOString();
    }
    // Anchor to the scheduled time, not now, to prevent drift.
    // Skip past any missed intervals so we always land in the future.
    let next = new Date(task.next_run!).getTime() + ms;
    while (next <= now) {
      next += ms;
    }
    return new Date(next).toISOString();
  }

  return null;
}
