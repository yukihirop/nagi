import fs from "node:fs";
import path from "node:path";
import type { Server } from "node:http";

import { createLogger } from "@nagi/logger";
import { type ResolvedConfig } from "@nagi/config";
import { type NagiDatabase, createDatabase } from "@nagi/db";
import { type Channel, ChannelRegistry, type ChannelOpts } from "@nagi/channel-core";
import { GroupQueue } from "@nagi/queue";
import { TaskScheduler } from "@nagi/scheduler";
import { IpcWatcher } from "@nagi/ipc";
import { loadSenderAllowlist, type SenderAllowlistConfig } from "@nagi/auth";
import type { MountAllowlist } from "@nagi/types";
import { startCredentialProxy } from "@nagi/credential-proxy";
import type { NewMessage } from "@nagi/types";

import { AppState } from "./state.js";
import { resolveAgentConfig } from "./container-runner-configs/agent-config.js";
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

export interface HooksConfig {
  postToolUse?: boolean;
  sessionStart?: boolean;
  skipTools?: string[];
}

export interface McpPluginConfig {
  /** Path to the MCP server entry point inside the container */
  entryPoint: string;
  /** Environment variables to pass to the MCP server process */
  env?: Record<string, string>;
}

export class Orchestrator {
  private config: ResolvedConfig;
  private db: NagiDatabase;
  private state: AppState;
  private channelRegistry: ChannelRegistry;
  private queue: GroupQueue;
  private channels: Channel[] = [];
  private mcpPlugins = new Map<string, McpPluginConfig>();
  private hooksConfig: HooksConfig | null = null;
  private mountAllowlist: MountAllowlist | null = null;
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
    const storeDir = `${this.config.paths.dataDir}/store`;
    fs.mkdirSync(storeDir, { recursive: true });
    this.db = createDatabase({
      path: `${storeDir}/messages.db`,
    });

    // Initialize state
    this.state = new AppState();
    const agentType = resolveAgentConfig(config.container.image).agentType;
    this.state.load(this.db, agentType);

    // Initialize queue
    this.queue = new GroupQueue({
      maxConcurrent: config.container.maxConcurrent,
      dataDir: config.paths.dataDir,
    });

    // Load sender allowlist
    this.allowlist = loadSenderAllowlist(config.paths.senderAllowlistPath);
  }

  registerMcpPlugin(name: string, config: McpPluginConfig): void {
    this.mcpPlugins.set(name, config);
    logger.info({ name, entryPoint: config.entryPoint }, "MCP plugin registered");
  }

  registerHooksPlugin(config: HooksConfig): void {
    this.hooksConfig = config;
    logger.info(config, "Hooks plugin registered");
  }

  getHooksConfig(): HooksConfig | null {
    return this.hooksConfig;
  }

  getMcpPlugins(): Array<{ name: string; entryPoint: string; env?: Record<string, string> }> {
    return [...this.mcpPlugins.entries()].map(([name, config]) => ({
      name,
      entryPoint: config.entryPoint,
      env: config.env,
    }));
  }

  setMountAllowlist(allowlist: MountAllowlist): void {
    this.mountAllowlist = allowlist;
    logger.info(
      { allowedRoots: allowlist.allowedRoots.length, blockedPatterns: allowlist.blockedPatterns.length },
      "Mount allowlist configured",
    );
  }

  getMountAllowlist(): MountAllowlist | null {
    return this.mountAllowlist;
  }

  /**
   * Copy group template files (e.g. CLAUDE.md) from deploy/default/groups/{channel}/{folder}/
   * to __data/groups/{channel}/{folder}/.
   * Only copies files that don't already exist in the runtime directory
   * to preserve user customizations.
   */
  private syncGroupTemplates(): void {
    const templateDir = path.join(process.cwd(), "deploy", "default", "groups");
    const runtimeDir = this.config.paths.groupsDir;

    if (!fs.existsSync(templateDir)) return;

    // Scan 2 levels: deploy/default/groups/{channel}/{folder}/
    for (const channel of fs.readdirSync(templateDir)) {
      const channelDir = path.join(templateDir, channel);
      if (!fs.statSync(channelDir).isDirectory()) continue;

      for (const groupFolder of fs.readdirSync(channelDir)) {
        const srcDir = path.join(channelDir, groupFolder);
        if (!fs.statSync(srcDir).isDirectory()) continue;

        const dstDir = path.join(runtimeDir, channel, groupFolder);
        fs.mkdirSync(dstDir, { recursive: true });

        for (const file of fs.readdirSync(srcDir)) {
          const srcFile = path.join(srcDir, file);
          const dstFile = path.join(dstDir, file);
          if (fs.statSync(srcFile).isFile() && !fs.existsSync(dstFile)) {
            fs.copyFileSync(srcFile, dstFile);
            logger.info({ file: `${channel}/${groupFolder}/${file}` }, "Group template synced");
          }
        }
      }
    }
  }

  async start(): Promise<void> {
    // Sync group templates to runtime data directory
    this.syncGroupTemplates();

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
            group.channel,
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
          channel: string,
          groupFolder: string,
          isMain: boolean,
          availableGroups: Array<{ jid: string; name: string; folder?: string }>,
          _registeredJids: Set<string>,
        ) => {
          writeGroupsSnapshot(
            this.config.paths.dataDir,
            channel,
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
      mcpPlugins: this.getMcpPlugins(),
      hooksConfig: this.hooksConfig,
      mountAllowlist: this.mountAllowlist,
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
