import { z } from "zod/v4";

export const ScheduleTypeSchema = z.enum(["cron", "interval", "once"]);
export type ScheduleType = z.infer<typeof ScheduleTypeSchema>;

export const ContextModeSchema = z.enum(["group", "isolated"]);
export type ContextMode = z.infer<typeof ContextModeSchema>;

export const TaskStatusSchema = z.enum(["active", "paused", "completed"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const ScheduledTaskSchema = z.object({
  id: z.string(),
  group_folder: z.string(),
  chat_jid: z.string(),
  prompt: z.string(),
  schedule_type: ScheduleTypeSchema,
  schedule_value: z.string(),
  context_mode: ContextModeSchema,
  next_run: z.string().nullable(),
  last_run: z.string().nullable(),
  last_result: z.string().nullable(),
  status: TaskStatusSchema,
  created_at: z.string(),
});

export type ScheduledTask = z.infer<typeof ScheduledTaskSchema>;

export const TaskRunStatusSchema = z.enum(["success", "error"]);
export type TaskRunStatus = z.infer<typeof TaskRunStatusSchema>;

export const TaskRunLogSchema = z.object({
  task_id: z.string(),
  run_at: z.string(),
  duration_ms: z.number(),
  status: TaskRunStatusSchema,
  result: z.string().nullable(),
  error: z.string().nullable(),
});

export type TaskRunLog = z.infer<typeof TaskRunLogSchema>;
