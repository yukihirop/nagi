import { CronExpressionParser } from "cron-parser";
import { createLogger } from "@nagi/logger";
import type { RegisteredGroup, ScheduledTask } from "@nagi/types";

const logger = createLogger({ name: "ipc" });

export interface IpcTaskRepo {
  create(task: Omit<ScheduledTask, "last_run" | "last_result">): void;
  getById(id: string): ScheduledTask | undefined;
  update(
    id: string,
    updates: Partial<
      Pick<
        ScheduledTask,
        "prompt" | "schedule_type" | "schedule_value" | "next_run" | "status"
      >
    >,
  ): void;
  delete(id: string): void;
}

export interface IpcDeps {
  sendMessage: (jid: string, text: string) => Promise<void>;
  registeredGroups: () => Record<string, RegisteredGroup>;
  registerGroup: (jid: string, group: RegisteredGroup) => void;
  syncGroups: (force: boolean) => Promise<void>;
  getAvailableGroups: () => Array<{ jid: string; name: string; folder?: string }>;
  writeGroupsSnapshot: (
    groupFolder: string,
    isMain: boolean,
    availableGroups: Array<{ jid: string; name: string; folder?: string }>,
    registeredJids: Set<string>,
  ) => void;
  onTasksChanged: () => void;
}

function isValidGroupFolder(folder: string): boolean {
  if (!folder || folder.includes("/") || folder.includes("\\")) return false;
  if (folder === "." || folder === ".." || folder.includes("\0")) return false;
  return /^[a-zA-Z0-9_-]+$/.test(folder);
}

export async function processTaskIpc(
  data: {
    type: string;
    taskId?: string;
    prompt?: string;
    schedule_type?: string;
    schedule_value?: string;
    context_mode?: string;
    groupFolder?: string;
    chatJid?: string;
    targetJid?: string;
    jid?: string;
    name?: string;
    folder?: string;
    trigger?: string;
    requiresTrigger?: boolean;
    containerConfig?: RegisteredGroup["containerConfig"];
  },
  sourceGroup: string,
  isMain: boolean,
  deps: IpcDeps,
  taskRepo: IpcTaskRepo,
  timezone: string,
): Promise<void> {
  const registeredGroups = deps.registeredGroups();

  switch (data.type) {
    case "schedule_task":
      if (
        data.prompt &&
        data.schedule_type &&
        data.schedule_value &&
        data.targetJid
      ) {
        const targetJid = data.targetJid;
        const targetGroupEntry = registeredGroups[targetJid];

        if (!targetGroupEntry) {
          logger.warn(
            { targetJid },
            "Cannot schedule task: target group not registered",
          );
          break;
        }

        const targetFolder = targetGroupEntry.folder;

        if (!isMain && targetFolder !== sourceGroup) {
          logger.warn(
            { sourceGroup, targetFolder },
            "Unauthorized schedule_task attempt blocked",
          );
          break;
        }

        const scheduleType = data.schedule_type as
          | "cron"
          | "interval"
          | "once";

        let nextRun: string | null = null;
        if (scheduleType === "cron") {
          try {
            const interval = CronExpressionParser.parse(data.schedule_value, {
              tz: timezone,
            });
            nextRun = interval.next().toISOString();
          } catch {
            logger.warn(
              { scheduleValue: data.schedule_value },
              "Invalid cron expression",
            );
            break;
          }
        } else if (scheduleType === "interval") {
          const ms = parseInt(data.schedule_value, 10);
          if (isNaN(ms) || ms <= 0) {
            logger.warn(
              { scheduleValue: data.schedule_value },
              "Invalid interval",
            );
            break;
          }
          nextRun = new Date(Date.now() + ms).toISOString();
        } else if (scheduleType === "once") {
          const date = new Date(data.schedule_value);
          if (isNaN(date.getTime())) {
            logger.warn(
              { scheduleValue: data.schedule_value },
              "Invalid timestamp",
            );
            break;
          }
          nextRun = date.toISOString();
        }

        const taskId =
          data.taskId ||
          `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const contextMode =
          data.context_mode === "group" || data.context_mode === "isolated"
            ? data.context_mode
            : "isolated";
        taskRepo.create({
          id: taskId,
          group_folder: targetFolder,
          chat_jid: targetJid,
          prompt: data.prompt,
          schedule_type: scheduleType,
          schedule_value: data.schedule_value,
          context_mode: contextMode,
          next_run: nextRun,
          status: "active",
          created_at: new Date().toISOString(),
        });
        logger.info(
          { taskId, sourceGroup, targetFolder, contextMode },
          "Task created via IPC",
        );
        deps.onTasksChanged();
      }
      break;

    case "pause_task":
      if (data.taskId) {
        const task = taskRepo.getById(data.taskId);
        if (task && (isMain || task.group_folder === sourceGroup)) {
          taskRepo.update(data.taskId, { status: "paused" });
          logger.info(
            { taskId: data.taskId, sourceGroup },
            "Task paused via IPC",
          );
          deps.onTasksChanged();
        } else {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            "Unauthorized task pause attempt",
          );
        }
      }
      break;

    case "resume_task":
      if (data.taskId) {
        const task = taskRepo.getById(data.taskId);
        if (task && (isMain || task.group_folder === sourceGroup)) {
          taskRepo.update(data.taskId, { status: "active" });
          logger.info(
            { taskId: data.taskId, sourceGroup },
            "Task resumed via IPC",
          );
          deps.onTasksChanged();
        } else {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            "Unauthorized task resume attempt",
          );
        }
      }
      break;

    case "cancel_task":
      if (data.taskId) {
        const task = taskRepo.getById(data.taskId);
        if (task && (isMain || task.group_folder === sourceGroup)) {
          taskRepo.delete(data.taskId);
          logger.info(
            { taskId: data.taskId, sourceGroup },
            "Task cancelled via IPC",
          );
          deps.onTasksChanged();
        } else {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            "Unauthorized task cancel attempt",
          );
        }
      }
      break;

    case "update_task":
      if (data.taskId) {
        const task = taskRepo.getById(data.taskId);
        if (!task) {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            "Task not found for update",
          );
          break;
        }
        if (!isMain && task.group_folder !== sourceGroup) {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            "Unauthorized task update attempt",
          );
          break;
        }

        const updates: Partial<
          Pick<
            ScheduledTask,
            | "prompt"
            | "schedule_type"
            | "schedule_value"
            | "next_run"
            | "status"
          >
        > = {};
        if (data.prompt !== undefined) updates.prompt = data.prompt;
        if (data.schedule_type !== undefined)
          updates.schedule_type = data.schedule_type as
            | "cron"
            | "interval"
            | "once";
        if (data.schedule_value !== undefined)
          updates.schedule_value = data.schedule_value;

        if (data.schedule_type || data.schedule_value) {
          const updatedTask = { ...task, ...updates };
          if (updatedTask.schedule_type === "cron") {
            try {
              const interval = CronExpressionParser.parse(
                updatedTask.schedule_value,
                { tz: timezone },
              );
              updates.next_run = interval.next().toISOString();
            } catch {
              logger.warn(
                { taskId: data.taskId, value: updatedTask.schedule_value },
                "Invalid cron in task update",
              );
              break;
            }
          } else if (updatedTask.schedule_type === "interval") {
            const ms = parseInt(updatedTask.schedule_value, 10);
            if (!isNaN(ms) && ms > 0) {
              updates.next_run = new Date(Date.now() + ms).toISOString();
            }
          }
        }

        taskRepo.update(data.taskId, updates);
        logger.info(
          { taskId: data.taskId, sourceGroup, updates },
          "Task updated via IPC",
        );
        deps.onTasksChanged();
      }
      break;

    case "refresh_groups":
      if (isMain) {
        logger.info(
          { sourceGroup },
          "Group metadata refresh requested via IPC",
        );
        await deps.syncGroups(true);
        const availableGroups = deps.getAvailableGroups();
        deps.writeGroupsSnapshot(
          sourceGroup,
          true,
          availableGroups,
          new Set(Object.keys(registeredGroups)),
        );
      } else {
        logger.warn(
          { sourceGroup },
          "Unauthorized refresh_groups attempt blocked",
        );
      }
      break;

    case "register_group":
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          "Unauthorized register_group attempt blocked",
        );
        break;
      }
      if (data.jid && data.name && data.folder && data.trigger) {
        if (!isValidGroupFolder(data.folder)) {
          logger.warn(
            { sourceGroup, folder: data.folder },
            "Invalid register_group request - unsafe folder name",
          );
          break;
        }
        deps.registerGroup(data.jid, {
          name: data.name,
          folder: data.folder,
          trigger: data.trigger,
          added_at: new Date().toISOString(),
          containerConfig: data.containerConfig,
          requiresTrigger: data.requiresTrigger,
        });
      } else {
        logger.warn(
          { data },
          "Invalid register_group request - missing required fields",
        );
      }
      break;

    default:
      logger.warn({ type: data.type }, "Unknown IPC task type");
  }
}
