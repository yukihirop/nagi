import { createLogger } from "@nagi/logger";
import type { ResolvedConfig } from "@nagi/config";
import type { NagiDatabase } from "@nagi/db";
import type { Channel } from "@nagi/channel-core";
import type { GroupQueue } from "@nagi/queue";
import type { SenderAllowlistConfig } from "@nagi/auth";
import { isSenderAllowed } from "@nagi/auth";

import type { AppState } from "./state.js";
import { runAgent, type AgentExecutorDeps } from "./agent-executor.js";

const logger = createLogger({ name: "orchestrator" });

export interface MessageLoopDeps {
  state: AppState;
  config: ResolvedConfig;
  db: NagiDatabase;
  queue: GroupQueue;
  channels: Channel[];
  allowlist: SenderAllowlistConfig;
  mcpPlugins?: Array<{ name: string; entryPoint: string; env?: Record<string, string> }>;
  mountAllowlist?: import("@nagi/types").MountAllowlist | null;
}

export function startMessageLoop(deps: MessageLoopDeps): { stop: () => void } {
  const { state, config, db, queue, channels, allowlist } = deps;
  let running = true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const agentDeps: AgentExecutorDeps = {
    state,
    config,
    db,
    queue,
    channels,
    mcpPlugins: deps.mcpPlugins,
    mountAllowlist: deps.mountAllowlist,
  };

  // Set up queue's message processor
  queue.setProcessMessagesFn(async (groupJid: string) => {
    const group = state.registeredGroups[groupJid];
    if (!group) return false;

    const lastAgentTs = state.lastAgentTimestamp[groupJid] || "";
    const messages = db.messages.getSince(
      groupJid,
      lastAgentTs,
      config.assistantName,
    );

    if (messages.length === 0) return true;

    // Check trigger for non-main groups
    const isMain = group.isMain === true;
    if (!isMain && group.requiresTrigger !== false) {
      const triggered = messages.some(
        (m) =>
          config.triggerPattern.test(m.content) &&
          isSenderAllowed(groupJid, m.sender, allowlist),
      );
      if (!triggered) {
        logger.debug({ groupJid }, "No trigger found, skipping");
        return true;
      }
    }

    // Advance cursor before processing (crash-safe)
    const lastMsg = messages[messages.length - 1];
    const previousTs = state.lastAgentTimestamp[groupJid];
    state.lastAgentTimestamp[groupJid] = lastMsg.timestamp;
    state.saveTimestamps(db);

    // Set typing indicator
    const channel = channels.find(
      (c) => c.ownsJid(groupJid) && c.isConnected(),
    );
    if (channel?.setTyping) {
      await channel.setTyping(groupJid, true).catch(() => {});
    }

    const result = await runAgent(groupJid, messages, agentDeps);

    if (channel?.setTyping) {
      await channel.setTyping(groupJid, false).catch(() => {});
    }

    if (result === "error" && previousTs !== undefined) {
      // Rollback cursor on error if no output was sent
      state.lastAgentTimestamp[groupJid] = previousTs;
      state.saveTimestamps(db);
    }

    return result === "success";
  });

  const poll = async () => {
    if (!running) return;

    try {
      const jids = Object.keys(state.registeredGroups);
      const result = db.messages.getNew(
        jids,
        state.lastTimestamp,
        config.assistantName,
      );

      if (result.messages.length > 0) {
        state.lastTimestamp = result.newTimestamp;
        state.saveTimestamps(db);

        // Group messages by chat_jid and enqueue
        const grouped = new Map<string, boolean>();
        for (const msg of result.messages) {
          if (!grouped.has(msg.chat_jid)) {
            grouped.set(msg.chat_jid, true);
            // Try to pipe to active container first
            if (!queue.sendMessage(msg.chat_jid, msg.content)) {
              queue.enqueueMessageCheck(msg.chat_jid);
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "Error in message loop");
    }

    if (running) {
      timer = setTimeout(poll, config.intervals.poll);
    }
  };

  poll();
  logger.info("Message loop started");

  return {
    stop() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      logger.info("Message loop stopped");
    },
  };
}
