import fs from "node:fs";
import type { Server } from "node:http";

import { createLogger } from "@nagi/logger";
import { type ResolvedConfig } from "@nagi/config";
import { type NagiDatabase, createDatabase } from "@nagi/db";
import { type Channel, ChannelRegistry, type ChannelOpts } from "@nagi/channel-core";
import { GroupQueue } from "@nagi/queue";
import { TaskScheduler } from "@nagi/scheduler";
import { IpcWatcher } from "@nagi/ipc";
import { loadSenderAllowlist, type SenderAllowlistConfig } from "@nagi/auth";
import { startCredentialProxy } from "@nagi/credential-proxy";
import type { NewMessage } from "@nagi/types";

import { AppState } from "./state.js";
import {
  ensureContainerRuntimeRunning,
  cleanupOrphans,
  detectProxyBindHost,
} from "./container-runtime.js";
import { startMessageLoop, type MessageLoopDeps } from "./message-loop.js";
import { isValidGroupFolder, resolveGroupFolderPath } from "./group-folder.js";
import {
  writeGroupsSnapshot,
  type AvailableGroup,
} from "./container-runner.js";

const logger = createLogger({ name: "orchestrator" });

export class Orchestrator {
  private config: ResolvedConfig;
  private db: NagiDatabase;
  private state: AppState;
  private channelRegistry: ChannelRegistry;
  private queue: GroupQueue;
  private channels: Channel[] = [];
  private allowlist: SenderAllowlistConfig;
  private scheduler: TaskScheduler | null = null;
  private ipcWatcher: IpcWatcher | null = null;
  private messageLoop: { stop: () => void } | null = null;
  private proxyServer: Server | null = null;

  constructor(
    config: ResolvedConfig,
    channelRegistry: ChannelRegistry,
  ) {
    this.config = config;
    this.channelRegistry = channelRegistry;

    // Initialize database
    fs.mkdirSync(this.config.paths.storeDir, { recursive: true });
    this.db = createDatabase({
      path: `${this.config.paths.storeDir}/messages.db`,
    });

    // Initialize state
    this.state = new AppState();
    this.state.load(this.db);

    // Initialize queue
    this.queue = new GroupQueue({
      maxConcurrent: config.container.maxConcurrent,
      dataDir: config.paths.dataDir,
    });

    // Load sender allowlist
    this.allowlist = loadSenderAllowlist(config.paths.senderAllowlistPath);
  }

  async start(): Promise<void> {
    // Validate container runtime
    ensureContainerRuntimeRunning();
    cleanupOrphans();

    // Start credential proxy
    const proxyHost = detectProxyBindHost();
    this.proxyServer = await startCredentialProxy({
      port: this.config.container.credentialProxyPort,
      host: proxyHost,
    });

    // Connect channels
    const channelOpts: ChannelOpts = {
      onMessage: (chatJid: string, message: NewMessage) => {
        this.db.messages.store(message);
        this.db.chats.storeChatMetadata(chatJid, message.timestamp);
      },
      onChatMetadata: (
        chatJid: string,
        timestamp: string,
        name?: string,
        channel?: string,
        isGroup?: boolean,
      ) => {
        this.db.chats.storeChatMetadata(
          chatJid,
          timestamp,
          name,
          channel,
          isGroup,
        );
      },
      registeredGroups: () => this.state.registeredGroups,
    };

    for (const channelName of this.channelRegistry.getAll()) {
      const factory = this.channelRegistry.get(channelName)!;
      const channel = factory(channelOpts);
      if (!channel) {
        logger.warn({ channel: channelName }, "Channel not configured, skipping");
        continue;
      }
      try {
        await channel.connect();
        this.channels.push(channel);
        logger.info({ channel: channelName }, "Channel connected");
      } catch (err) {
        logger.error({ channel: channelName, err }, "Failed to connect channel");
      }
    }

    if (this.channels.length === 0) {
      logger.warn("No channels connected");
    }

    // Start scheduler
    this.scheduler = new TaskScheduler({
      pollInterval: this.config.intervals.schedulerPoll,
      taskRepo: this.db.tasks,
      queue: this.queue,
      executor: async (task) => {
        logger.info({ taskId: task.id }, "Executing scheduled task");
      },
    });
    this.scheduler.start();

    // Start IPC watcher
    this.ipcWatcher = new IpcWatcher({
      dataDir: this.config.paths.dataDir,
      pollInterval: this.config.intervals.ipcPoll,
      timezone: this.config.timezone,
      taskRepo: this.db.tasks,
      deps: {
        sendMessage: async (jid: string, text: string) => {
          const channel = this.channels.find(
            (c) => c.ownsJid(jid) && c.isConnected(),
          );
          if (channel) {
            await channel.sendMessage(jid, text);
          }
        },
        registeredGroups: () => this.state.registeredGroups,
        registerGroup: (jid, group) => {
          if (!isValidGroupFolder(group.folder)) {
            logger.warn({ jid, folder: group.folder }, "Invalid group folder");
            return;
          }
          this.state.registerGroup(this.db, jid, group);
          const groupDir = resolveGroupFolderPath(
            this.config.paths.groupsDir,
            group.folder,
          );
          fs.mkdirSync(groupDir, { recursive: true });
        },
        syncGroups: async (force: boolean) => {
          for (const channel of this.channels) {
            if (channel.syncGroups) {
              await channel.syncGroups(force);
            }
          }
        },
        getAvailableGroups: () => {
          const allChats = this.db.chats.getAll();
          return allChats.map((chat) => ({
            jid: chat.jid,
            name: chat.name,
            lastActivity: chat.last_message_time,
            isRegistered: chat.jid in this.state.registeredGroups,
          }));
        },
        writeGroupsSnapshot: (
          groupFolder: string,
          isMain: boolean,
          availableGroups: Array<{ jid: string; name: string; folder?: string }>,
          _registeredJids: Set<string>,
        ) => {
          writeGroupsSnapshot(
            this.config.paths.dataDir,
            groupFolder,
            isMain,
            availableGroups as AvailableGroup[],
          );
        },
        onTasksChanged: () => {
          // Task snapshots will be written on next container launch
        },
      },
    });
    this.ipcWatcher.start();

    // Start message loop
    const loopDeps: MessageLoopDeps = {
      state: this.state,
      config: this.config,
      db: this.db,
      queue: this.queue,
      channels: this.channels,
      allowlist: this.allowlist,
    };
    this.messageLoop = startMessageLoop(loopDeps);

    logger.info("Orchestrator started");
  }

  async shutdown(): Promise<void> {
    logger.info("Shutting down...");

    this.messageLoop?.stop();
    this.scheduler?.stop();
    this.ipcWatcher?.stop();

    await this.queue.shutdown(30000);

    for (const channel of this.channels) {
      try {
        await channel.disconnect();
      } catch (err) {
        logger.error({ channel: channel.name, err }, "Error disconnecting channel");
      }
    }

    if (this.proxyServer) {
      await new Promise<void>((resolve) =>
        this.proxyServer!.close(() => resolve()),
      );
    }

    this.db.close();
    logger.info("Orchestrator stopped");
  }
}
