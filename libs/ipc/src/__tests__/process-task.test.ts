import { describe, expect, it, vi, beforeEach } from "vitest";
import { processTaskIpc, type IpcDeps, type IpcTaskRepo } from "../index.js";

function createMockDeps(): IpcDeps {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    registeredGroups: vi.fn().mockReturnValue({
      "discord:123": {
        name: "Test",
        channel: "discord",
        folder: "main",
        trigger: "!test",
        added_at: "2026-01-01T00:00:00Z",
        isMain: true,
      },
      "discord:456": {
        name: "Other",
        channel: "discord",
        folder: "other",
        trigger: "!other",
        added_at: "2026-01-01T00:00:00Z",
      },
    }),
    registerGroup: vi.fn(),
    syncGroups: vi.fn().mockResolvedValue(undefined),
    getAvailableGroups: vi.fn().mockReturnValue([]),
    writeGroupsSnapshot: vi.fn(),
    onTasksChanged: vi.fn(),
  };
}

function createMockTaskRepo(): IpcTaskRepo {
  return {
    create: vi.fn(),
    getById: vi.fn().mockReturnValue({
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
    }),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

describe("processTaskIpc", () => {
  let deps: IpcDeps;
  let taskRepo: IpcTaskRepo;

  beforeEach(() => {
    deps = createMockDeps();
    taskRepo = createMockTaskRepo();
  });

  describe("schedule_task", () => {
    it("creates a cron task from main group", async () => {
      await processTaskIpc(
        {
          type: "schedule_task",
          prompt: "check status",
          schedule_type: "cron",
          schedule_value: "0 9 * * *",
          targetJid: "discord:123",
        },
        "discord",
        "main",
        true,
        deps,
        taskRepo,
        "UTC",
      );

      expect(taskRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "check status",
          schedule_type: "cron",
          status: "active",
        }),
      );
      expect(deps.onTasksChanged).toHaveBeenCalled();
    });

    it("blocks unauthorized schedule from non-main", async () => {
      await processTaskIpc(
        {
          type: "schedule_task",
          prompt: "hack",
          schedule_type: "cron",
          schedule_value: "0 9 * * *",
          targetJid: "discord:123", // main's JID
        },
        "discord",
        "other",
        false,
        deps,
        taskRepo,
        "UTC",
      );

      expect(taskRepo.create).not.toHaveBeenCalled();
    });

    it("rejects invalid cron expression", async () => {
      await processTaskIpc(
        {
          type: "schedule_task",
          prompt: "test",
          schedule_type: "cron",
          schedule_value: "invalid cron",
          targetJid: "discord:123",
        },
        "discord",
        "main",
        true,
        deps,
        taskRepo,
        "UTC",
      );

      expect(taskRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("pause_task", () => {
    it("pauses task from authorized group", async () => {
      await processTaskIpc(
        { type: "pause_task", taskId: "task-1" },
        "discord",
        "main",
        true,
        deps,
        taskRepo,
        "UTC",
      );

      expect(taskRepo.update).toHaveBeenCalledWith("task-1", {
        status: "paused",
      });
      expect(deps.onTasksChanged).toHaveBeenCalled();
    });

    it("blocks unauthorized pause", async () => {
      await processTaskIpc(
        { type: "pause_task", taskId: "task-1" },
        "discord",
        "other",
        false,
        deps,
        taskRepo,
        "UTC",
      );

      expect(taskRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("cancel_task", () => {
    it("deletes task from authorized group", async () => {
      await processTaskIpc(
        { type: "cancel_task", taskId: "task-1" },
        "discord",
        "main",
        true,
        deps,
        taskRepo,
        "UTC",
      );

      expect(taskRepo.delete).toHaveBeenCalledWith("task-1");
    });
  });

  describe("register_group", () => {
    it("registers group from main", async () => {
      await processTaskIpc(
        {
          type: "register_group",
          jid: "discord:789",
          name: "New Group",
          folder: "newgroup",
          trigger: "!new",
        },
        "discord",
        "main",
        true,
        deps,
        taskRepo,
        "UTC",
      );

      expect(deps.registerGroup).toHaveBeenCalledWith(
        "discord:789",
        expect.objectContaining({
          name: "New Group",
          folder: "newgroup",
          trigger: "!new",
        }),
      );
    });

    it("blocks register from non-main", async () => {
      await processTaskIpc(
        {
          type: "register_group",
          jid: "discord:789",
          name: "Hack",
          folder: "hack",
          trigger: "!hack",
        },
        "discord",
        "other",
        false,
        deps,
        taskRepo,
        "UTC",
      );

      expect(deps.registerGroup).not.toHaveBeenCalled();
    });

    it("rejects unsafe folder names", async () => {
      await processTaskIpc(
        {
          type: "register_group",
          jid: "discord:789",
          name: "Bad",
          folder: "../etc",
          trigger: "!bad",
        },
        "discord",
        "main",
        true,
        deps,
        taskRepo,
        "UTC",
      );

      expect(deps.registerGroup).not.toHaveBeenCalled();
    });
  });

  describe("refresh_groups", () => {
    it("syncs groups from main", async () => {
      await processTaskIpc(
        { type: "refresh_groups" },
        "discord",
        "main",
        true,
        deps,
        taskRepo,
        "UTC",
      );

      expect(deps.syncGroups).toHaveBeenCalledWith(true);
      expect(deps.writeGroupsSnapshot).toHaveBeenCalled();
    });

    it("blocks refresh from non-main", async () => {
      await processTaskIpc(
        { type: "refresh_groups" },
        "discord",
        "other",
        false,
        deps,
        taskRepo,
        "UTC",
      );

      expect(deps.syncGroups).not.toHaveBeenCalled();
    });
  });
});
