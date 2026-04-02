import { describe, expect, it } from "vitest";
import {
  NewMessageSchema,
  RegisteredGroupSchema,
  AdditionalMountSchema,
  ContainerConfigSchema,
  ScheduledTaskSchema,
  TaskRunLogSchema,
  ScheduleTypeSchema,
  ContextModeSchema,
  TaskStatusSchema,
  TaskRunStatusSchema,
} from "../index.js";

describe("NewMessageSchema", () => {
  it("parses a valid message", () => {
    const msg = {
      id: "msg-1",
      chat_jid: "chat@jid",
      sender: "user@jid",
      sender_name: "Alice",
      content: "hello",
      timestamp: "2026-01-01T00:00:00Z",
    };
    expect(NewMessageSchema.parse(msg)).toEqual(msg);
  });

  it("parses with optional fields", () => {
    const msg = {
      id: "msg-2",
      chat_jid: "chat@jid",
      sender: "user@jid",
      sender_name: "Bob",
      content: "hi",
      timestamp: "2026-01-01T00:00:00Z",
      is_from_me: true,
      is_bot_message: false,
    };
    expect(NewMessageSchema.parse(msg)).toEqual(msg);
  });

  it("rejects missing required fields", () => {
    expect(() => NewMessageSchema.parse({ id: "msg-3" })).toThrow();
  });
});

describe("RegisteredGroupSchema", () => {
  it("parses a minimal group", () => {
    const group = {
      name: "test-group",
      channel: "discord",
      folder: "test",
      trigger: "!test",
      added_at: "2026-01-01T00:00:00Z",
    };
    expect(RegisteredGroupSchema.parse(group)).toEqual(group);
  });

  it("parses with containerConfig", () => {
    const group = {
      name: "main",
      channel: "discord",
      folder: "main",
      trigger: "",
      added_at: "2026-01-01T00:00:00Z",
      containerConfig: {
        additionalMounts: [
          { hostPath: "/home/user/projects", readonly: true },
        ],
        timeout: 600000,
      },
      requiresTrigger: false,
      isMain: true,
    };
    expect(RegisteredGroupSchema.parse(group)).toEqual(group);
  });

  it("rejects missing folder", () => {
    expect(() =>
      RegisteredGroupSchema.parse({ name: "x", channel: "discord", trigger: "!x", added_at: "t" })
    ).toThrow();
  });
});

describe("AdditionalMountSchema", () => {
  it("parses with hostPath only", () => {
    expect(AdditionalMountSchema.parse({ hostPath: "/tmp" })).toEqual({
      hostPath: "/tmp",
    });
  });

  it("parses with all fields", () => {
    const mount = {
      hostPath: "/home/user/data",
      containerPath: "data",
      readonly: false,
    };
    expect(AdditionalMountSchema.parse(mount)).toEqual(mount);
  });
});

describe("ContainerConfigSchema", () => {
  it("parses empty config", () => {
    expect(ContainerConfigSchema.parse({})).toEqual({});
  });

  it("parses with timeout", () => {
    expect(ContainerConfigSchema.parse({ timeout: 300000 })).toEqual({
      timeout: 300000,
    });
  });
});

describe("ScheduledTaskSchema", () => {
  const validTask = {
    id: "task-1",
    group_folder: "main",
    chat_jid: "chat@jid",
    prompt: "check status",
    schedule_type: "cron" as const,
    schedule_value: "0 9 * * *",
    context_mode: "group" as const,
    next_run: "2026-01-02T09:00:00Z",
    last_run: null,
    last_result: null,
    status: "active" as const,
    created_at: "2026-01-01T00:00:00Z",
  };

  it("parses a valid task", () => {
    expect(ScheduledTaskSchema.parse(validTask)).toEqual(validTask);
  });

  it("rejects invalid schedule_type", () => {
    expect(() =>
      ScheduledTaskSchema.parse({ ...validTask, schedule_type: "weekly" })
    ).toThrow();
  });

  it("rejects invalid status", () => {
    expect(() =>
      ScheduledTaskSchema.parse({ ...validTask, status: "running" })
    ).toThrow();
  });
});

describe("TaskRunLogSchema", () => {
  it("parses a success log", () => {
    const log = {
      task_id: "task-1",
      run_at: "2026-01-02T09:00:00Z",
      duration_ms: 1500,
      status: "success" as const,
      result: "all good",
      error: null,
    };
    expect(TaskRunLogSchema.parse(log)).toEqual(log);
  });

  it("parses an error log", () => {
    const log = {
      task_id: "task-1",
      run_at: "2026-01-02T09:00:00Z",
      duration_ms: 500,
      status: "error" as const,
      result: null,
      error: "timeout",
    };
    expect(TaskRunLogSchema.parse(log)).toEqual(log);
  });

  it("rejects invalid duration_ms type", () => {
    expect(() =>
      TaskRunLogSchema.parse({
        task_id: "t",
        run_at: "t",
        duration_ms: "slow",
        status: "success",
        result: null,
        error: null,
      })
    ).toThrow();
  });
});

describe("enum schemas", () => {
  it("ScheduleTypeSchema accepts valid values", () => {
    expect(ScheduleTypeSchema.parse("cron")).toBe("cron");
    expect(ScheduleTypeSchema.parse("interval")).toBe("interval");
    expect(ScheduleTypeSchema.parse("once")).toBe("once");
  });

  it("ContextModeSchema accepts valid values", () => {
    expect(ContextModeSchema.parse("group")).toBe("group");
    expect(ContextModeSchema.parse("isolated")).toBe("isolated");
  });

  it("TaskStatusSchema accepts valid values", () => {
    expect(TaskStatusSchema.parse("active")).toBe("active");
    expect(TaskStatusSchema.parse("paused")).toBe("paused");
    expect(TaskStatusSchema.parse("completed")).toBe("completed");
  });

  it("TaskRunStatusSchema accepts valid values", () => {
    expect(TaskRunStatusSchema.parse("success")).toBe("success");
    expect(TaskRunStatusSchema.parse("error")).toBe("error");
  });

  it("rejects invalid enum values", () => {
    expect(() => ScheduleTypeSchema.parse("weekly")).toThrow();
    expect(() => ContextModeSchema.parse("shared")).toThrow();
    expect(() => TaskStatusSchema.parse("running")).toThrow();
    expect(() => TaskRunStatusSchema.parse("timeout")).toThrow();
  });
});
