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

      // Scan 2 levels: ipc/{channel}/{folder}/
      let channelDirs: string[];
      try {
        channelDirs = fs.readdirSync(ipcBaseDir).filter((f) => {
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

      // Build lookup map: {channel}/{folder} -> isMain
      const groupIsMain = new Map<string, boolean>();
      for (const group of Object.values(registeredGroups)) {
        const key = `${group.channel}/${group.folder}`;
        if (group.isMain) groupIsMain.set(key, true);
      }

      for (const channel of channelDirs) {
        const channelDir = path.join(ipcBaseDir, channel);
        let groupFolders: string[];
        try {
          groupFolders = fs.readdirSync(channelDir).filter((f) => {
            const stat = fs.statSync(path.join(channelDir, f));
            return stat.isDirectory();
          });
        } catch (err) {
          logger.error({ err, channel }, "Error reading IPC channel directory");
          continue;
        }

        for (const folder of groupFolders) {
          const groupKey = `${channel}/${folder}`;
          const isMain = groupIsMain.get(groupKey) === true;
          const groupDir = path.join(channelDir, folder);
          const messagesDir = path.join(groupDir, "messages");
          const tasksDir = path.join(groupDir, "tasks");

          // Process messages
          await this.processMessages(
            messagesDir,
            channel,
            folder,
            isMain,
            registeredGroups,
            ipcBaseDir,
          );

          // Process tasks
          await this.processTasks(
            tasksDir,
            channel,
            folder,
            isMain,
            ipcBaseDir,
          );
        }
      }

      if (this.running) {
        this.timer = setTimeout(() => this.poll(), this.opts.pollInterval);
      }
    };

    run();
  }

  private async processMessages(
    messagesDir: string,
    sourceChannel: string,
    sourceFolder: string,
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
              (targetGroup && targetGroup.channel === sourceChannel && targetGroup.folder === sourceFolder)
            ) {
              await this.opts.deps.sendMessage(data.chatJid, data.text);
              logger.info(
                { chatJid: data.chatJid, sourceChannel, sourceFolder },
                "IPC message sent",
              );
            } else {
              logger.warn(
                { chatJid: data.chatJid, sourceChannel, sourceFolder },
                "Unauthorized IPC message attempt blocked",
              );
            }
          }
          fs.unlinkSync(filePath);
        } catch (err) {
          logger.error(
            { file, sourceChannel, sourceFolder, err },
            "Error processing IPC message",
          );
          const errorDir = path.join(ipcBaseDir, "errors");
          fs.mkdirSync(errorDir, { recursive: true });
          fs.renameSync(
            filePath,
            path.join(errorDir, `${sourceChannel}-${sourceFolder}-${file}`),
          );
        }
      }
    } catch (err) {
      logger.error(
        { err, sourceChannel, sourceFolder },
        "Error reading IPC messages directory",
      );
    }
  }

  private async processTasks(
    tasksDir: string,
    sourceChannel: string,
    sourceFolder: string,
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
            sourceChannel,
            sourceFolder,
            isMain,
            this.opts.deps,
            this.opts.taskRepo,
            this.opts.timezone,
          );
          fs.unlinkSync(filePath);
        } catch (err) {
          logger.error(
            { file, sourceChannel, sourceFolder, err },
            "Error processing IPC task",
          );
          const errorDir = path.join(ipcBaseDir, "errors");
          fs.mkdirSync(errorDir, { recursive: true });
          fs.renameSync(
            filePath,
            path.join(errorDir, `${sourceChannel}-${sourceFolder}-${file}`),
          );
        }
      }
    } catch (err) {
      logger.error({ err, sourceChannel, sourceFolder }, "Error reading IPC tasks directory");
    }
  }
}
