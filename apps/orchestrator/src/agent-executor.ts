import type { ChildProcess } from "node:child_process";
import fs from "node:fs";

import { createLogger } from "@nagi/logger";
import type { ResolvedConfig } from "@nagi/config";
import type { NagiDatabase } from "@nagi/db";
import type { Channel } from "@nagi/channel-core";
import type { NewMessage, RegisteredGroup } from "@nagi/types";
import { formatMessages, formatOutbound } from "@nagi/router";
import type { GroupQueue } from "@nagi/queue";

import type { AppState } from "./state.js";
import {
  runContainerAgent,
  writeTasksSnapshot,
  writeGroupsSnapshot,
  type ContainerOutput,
  type AvailableGroup,
} from "./container-runner.js";
import { resolveGroupFolderPath } from "./group-folder.js";

const logger = createLogger({ name: "orchestrator" });

export interface AgentExecutorDeps {
  state: AppState;
  config: ResolvedConfig;
  db: NagiDatabase;
  queue: GroupQueue;
  channels: Channel[];
}

export async function runAgent(
  groupJid: string,
  messages: NewMessage[],
  deps: AgentExecutorDeps,
): Promise<"success" | "error"> {
  const { state, config, db, queue, channels } = deps;
  const group = state.registeredGroups[groupJid];
  if (!group) {
    logger.error({ groupJid }, "Group not found for agent execution");
    return "error";
  }

  const isMain = group.isMain === true;
  const prompt = formatMessages(messages, config.timezone);
  const sessionId = state.sessions[group.folder];

  // Write snapshots for container to read
  const allTasks = db.tasks.getAll();
  writeTasksSnapshot(
    config.paths.dataDir,
    group.folder,
    isMain,
    allTasks.map((t) => ({
      id: t.id,
      groupFolder: t.group_folder,
      prompt: t.prompt,
      schedule_type: t.schedule_type,
      schedule_value: t.schedule_value,
      status: t.status,
      next_run: t.next_run,
    })),
  );

  if (isMain) {
    const allChats = db.chats.getAll();
    const availableGroups: AvailableGroup[] = allChats.map((chat) => ({
      jid: chat.jid,
      name: chat.name,
      lastActivity: chat.last_message_time,
      isRegistered: chat.jid in state.registeredGroups,
    }));
    writeGroupsSnapshot(
      config.paths.dataDir,
      group.folder,
      true,
      availableGroups,
    );
  }

  try {
    const output = await runContainerAgent(
      group,
      {
        prompt,
        sessionId,
        groupFolder: group.folder,
        chatJid: groupJid,
        isMain,
        assistantName: config.assistantName,
      },
      config,
      (proc: ChildProcess, containerName: string) => {
        queue.registerProcess(groupJid, proc, containerName, group.folder);
      },
      async (streamedOutput: ContainerOutput) => {
        if (streamedOutput.newSessionId) {
          state.updateSession(db, group.folder, streamedOutput.newSessionId);
        }
        if (streamedOutput.result) {
          const text = formatOutbound(streamedOutput.result);
          if (text) {
            const channel = channels.find(
              (c) => c.ownsJid(groupJid) && c.isConnected(),
            );
            if (channel) {
              await channel.sendMessage(groupJid, text);
            }
          }
        }
        if (streamedOutput.status === "success") {
          queue.notifyIdle(groupJid);
        }
      },
    );

    if (output.newSessionId) {
      state.updateSession(db, group.folder, output.newSessionId);
    }

    return output.status === "error" ? "error" : "success";
  } catch (err) {
    logger.error({ groupJid, err }, "Agent execution failed");
    return "error";
  }
}
