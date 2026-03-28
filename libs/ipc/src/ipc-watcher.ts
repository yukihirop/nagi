import fs from "node:fs";
import path from "node:path";
import { createLogger } from "@nagi/logger";
import type { RegisteredGroup } from "@nagi/types";
import { processTaskIpc, type IpcDeps, type IpcTaskRepo } from "./process-task.js";

const logger = createLogger({ name: "ipc" });

export interface IpcWatcherOptions {
  dataDir: string;
  pollInterval: number;
  timezone: string;
  taskRepo: IpcTaskRepo;
  deps: IpcDeps;
}

export class IpcWatcher {
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private opts: IpcWatcherOptions;

  constructor(opts: IpcWatcherOptions) {
    this.opts = opts;
  }

  start(): void {
    if (this.running) {
      logger.debug("IPC watcher already running, skipping duplicate start");
      return;
    }
    this.running = true;

    const ipcBaseDir = path.join(this.opts.dataDir, "ipc");
    fs.mkdirSync(ipcBaseDir, { recursive: true });

    this.poll();
    logger.info("IPC watcher started (per-group namespaces)");
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info("IPC watcher stopped");
  }

  private poll(): void {
    const run = async () => {
      const ipcBaseDir = path.join(this.opts.dataDir, "ipc");

      let groupFolders: string[];
      try {
        groupFolders = fs.readdirSync(ipcBaseDir).filter((f) => {
          const stat = fs.statSync(path.join(ipcBaseDir, f));
          return stat.isDirectory() && f !== "errors";
        });
      } catch (err) {
        logger.error({ err }, "Error reading IPC base directory");
        if (this.running) {
          this.timer = setTimeout(() => this.poll(), this.opts.pollInterval);
        }
        return;
      }

      const registeredGroups = this.opts.deps.registeredGroups();

      const folderIsMain = new Map<string, boolean>();
      for (const group of Object.values(registeredGroups)) {
        if (group.isMain) folderIsMain.set(group.folder, true);
      }

      for (const sourceGroup of groupFolders) {
        const isMain = folderIsMain.get(sourceGroup) === true;
        const messagesDir = path.join(ipcBaseDir, sourceGroup, "messages");
        const tasksDir = path.join(ipcBaseDir, sourceGroup, "tasks");

        // Process messages
        await this.processMessages(
          messagesDir,
          sourceGroup,
          isMain,
          registeredGroups,
          ipcBaseDir,
        );

        // Process tasks
        await this.processTasks(
          tasksDir,
          sourceGroup,
          isMain,
          ipcBaseDir,
        );
      }

      if (this.running) {
        this.timer = setTimeout(() => this.poll(), this.opts.pollInterval);
      }
    };

    run();
  }

  private async processMessages(
    messagesDir: string,
    sourceGroup: string,
    isMain: boolean,
    registeredGroups: Record<string, RegisteredGroup>,
    ipcBaseDir: string,
  ): Promise<void> {
    try {
      if (!fs.existsSync(messagesDir)) return;

      const messageFiles = fs
        .readdirSync(messagesDir)
        .filter((f) => f.endsWith(".json"));

      for (const file of messageFiles) {
        const filePath = path.join(messagesDir, file);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          if (data.type === "message" && data.chatJid && data.text) {
            const targetGroup = registeredGroups[data.chatJid];
            if (
              isMain ||
              (targetGroup && targetGroup.folder === sourceGroup)
            ) {
              await this.opts.deps.sendMessage(data.chatJid, data.text);
              logger.info(
                { chatJid: data.chatJid, sourceGroup },
                "IPC message sent",
              );
            } else {
              logger.warn(
                { chatJid: data.chatJid, sourceGroup },
                "Unauthorized IPC message attempt blocked",
              );
            }
          }
          fs.unlinkSync(filePath);
        } catch (err) {
          logger.error(
            { file, sourceGroup, err },
            "Error processing IPC message",
          );
          const errorDir = path.join(ipcBaseDir, "errors");
          fs.mkdirSync(errorDir, { recursive: true });
          fs.renameSync(
            filePath,
            path.join(errorDir, `${sourceGroup}-${file}`),
          );
        }
      }
    } catch (err) {
      logger.error(
        { err, sourceGroup },
        "Error reading IPC messages directory",
      );
    }
  }

  private async processTasks(
    tasksDir: string,
    sourceGroup: string,
    isMain: boolean,
    ipcBaseDir: string,
  ): Promise<void> {
    try {
      if (!fs.existsSync(tasksDir)) return;

      const taskFiles = fs
        .readdirSync(tasksDir)
        .filter((f) => f.endsWith(".json"));

      for (const file of taskFiles) {
        const filePath = path.join(tasksDir, file);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          await processTaskIpc(
            data,
            sourceGroup,
            isMain,
            this.opts.deps,
            this.opts.taskRepo,
            this.opts.timezone,
          );
          fs.unlinkSync(filePath);
        } catch (err) {
          logger.error(
            { file, sourceGroup, err },
            "Error processing IPC task",
          );
          const errorDir = path.join(ipcBaseDir, "errors");
          fs.mkdirSync(errorDir, { recursive: true });
          fs.renameSync(
            filePath,
            path.join(errorDir, `${sourceGroup}-${file}`),
          );
        }
      }
    } catch (err) {
      logger.error({ err, sourceGroup }, "Error reading IPC tasks directory");
    }
  }
}
