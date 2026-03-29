// IMPORTANT: This file is intentionally duplicated in agent-runner-claudecode and agent-runner-opencode.
// Each agent may diverge independently — sharing via a common lib with conditional branches
// tends to cause subtle bugs when one agent's behavior changes. Keep copies in sync manually.
/**
 * Stdio MCP Server for Nagi
 * Standalone process that agent teams subagents can inherit.
 * Reads context from environment variables, writes IPC files for the host.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { CronExpressionParser } from "cron-parser";

const IPC_DIR = "/workspace/ipc";
const MESSAGES_DIR = path.join(IPC_DIR, "messages");
const TASKS_DIR = path.join(IPC_DIR, "tasks");

const chatJid = process.env.NAGI_CHAT_JID!;
const groupFolder = process.env.NAGI_GROUP_FOLDER!;
const isMain = process.env.NAGI_IS_MAIN === "1";

function writeIpcFile(dir: string, data: object): string {
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(dir, filename);

  const tempPath = `${filepath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filepath);

  return filename;
}

const server = new McpServer({
  name: "nagi",
  version: "1.0.0",
});

server.tool(
  "send_message",
  "Send a message to the user or group immediately while you're still running. Use this for progress updates or to send multiple messages.",
  {
    text: z.string().describe("The message text to send"),
    sender: z
      .string()
      .optional()
      .describe(
        'Your role/identity name (e.g. "Researcher"). When set, messages appear from a named sender in the chat.',
      ),
  },
  async (args) => {
    const data: Record<string, string | undefined> = {
      type: "message",
      chatJid,
      text: args.text,
      sender: args.sender || undefined,
      groupFolder,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(MESSAGES_DIR, data);

    return { content: [{ type: "text" as const, text: "Message sent." }] };
  },
);

server.tool(
  "schedule_task",
  `Schedule a recurring or one-time task. The task will run as a full agent with access to all tools.

CONTEXT MODE:
- "group": Runs with chat history and memory
- "isolated": Fresh session (include all context in prompt)

SCHEDULE VALUE FORMAT (local timezone):
- cron: "0 9 * * *" (daily 9am)
- interval: "300000" (5 minutes in ms)
- once: "2026-02-01T15:30:00" (local time, no Z suffix)`,
  {
    prompt: z.string().describe("What the agent should do when the task runs"),
    schedule_type: z
      .enum(["cron", "interval", "once"])
      .describe("cron, interval, or once"),
    schedule_value: z.string().describe("Schedule value (see format above)"),
    context_mode: z
      .enum(["group", "isolated"])
      .default("group")
      .describe("group=with chat history, isolated=fresh session"),
    target_group_jid: z
      .string()
      .optional()
      .describe(
        "(Main group only) JID of the group to schedule the task for",
      ),
  },
  async (args) => {
    if (args.schedule_type === "cron") {
      try {
        CronExpressionParser.parse(args.schedule_value);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid cron: "${args.schedule_value}".`,
            },
          ],
          isError: true,
        };
      }
    } else if (args.schedule_type === "interval") {
      const ms = parseInt(args.schedule_value, 10);
      if (isNaN(ms) || ms <= 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid interval: "${args.schedule_value}".`,
            },
          ],
          isError: true,
        };
      }
    } else if (args.schedule_type === "once") {
      if (
        /[Zz]$/.test(args.schedule_value) ||
        /[+-]\d{2}:\d{2}$/.test(args.schedule_value)
      ) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Timestamp must be local time without timezone suffix. Got "${args.schedule_value}".`,
            },
          ],
          isError: true,
        };
      }
      const date = new Date(args.schedule_value);
      if (isNaN(date.getTime())) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid timestamp: "${args.schedule_value}".`,
            },
          ],
          isError: true,
        };
      }
    }

    const targetJid =
      isMain && args.target_group_jid ? args.target_group_jid : chatJid;
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const data = {
      type: "schedule_task",
      taskId,
      prompt: args.prompt,
      schedule_type: args.schedule_type,
      schedule_value: args.schedule_value,
      context_mode: args.context_mode || "group",
      targetJid,
      createdBy: groupFolder,
      timestamp: new Date().toISOString(),
    };

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: "text" as const,
          text: `Task ${taskId} scheduled: ${args.schedule_type} - ${args.schedule_value}`,
        },
      ],
    };
  },
);

server.tool(
  "list_tasks",
  "List all scheduled tasks. Main group sees all; others see only their own.",
  {},
  async () => {
    const tasksFile = path.join(IPC_DIR, "current_tasks.json");

    try {
      if (!fs.existsSync(tasksFile)) {
        return {
          content: [
            { type: "text" as const, text: "No scheduled tasks found." },
          ],
        };
      }

      const allTasks = JSON.parse(fs.readFileSync(tasksFile, "utf-8"));
      const tasks = isMain
        ? allTasks
        : allTasks.filter(
            (t: { groupFolder: string }) => t.groupFolder === groupFolder,
          );

      if (tasks.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No scheduled tasks found." },
          ],
        };
      }

      const formatted = tasks
        .map(
          (t: {
            id: string;
            prompt: string;
            schedule_type: string;
            schedule_value: string;
            status: string;
            next_run: string;
          }) =>
            `- [${t.id}] ${t.prompt.slice(0, 50)}... (${t.schedule_type}: ${t.schedule_value}) - ${t.status}, next: ${t.next_run || "N/A"}`,
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Scheduled tasks:\n${formatted}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error reading tasks: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

server.tool(
  "pause_task",
  "Pause a scheduled task.",
  { task_id: z.string().describe("The task ID to pause") },
  async (args) => {
    writeIpcFile(TASKS_DIR, {
      type: "pause_task",
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `Task ${args.task_id} pause requested.`,
        },
      ],
    };
  },
);

server.tool(
  "resume_task",
  "Resume a paused task.",
  { task_id: z.string().describe("The task ID to resume") },
  async (args) => {
    writeIpcFile(TASKS_DIR, {
      type: "resume_task",
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `Task ${args.task_id} resume requested.`,
        },
      ],
    };
  },
);

server.tool(
  "cancel_task",
  "Cancel and delete a scheduled task.",
  { task_id: z.string().describe("The task ID to cancel") },
  async (args) => {
    writeIpcFile(TASKS_DIR, {
      type: "cancel_task",
      taskId: args.task_id,
      groupFolder,
      isMain,
      timestamp: new Date().toISOString(),
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `Task ${args.task_id} cancellation requested.`,
        },
      ],
    };
  },
);

server.tool(
  "update_task",
  "Update an existing scheduled task. Only provided fields are changed.",
  {
    task_id: z.string().describe("The task ID to update"),
    prompt: z.string().optional().describe("New prompt"),
    schedule_type: z
      .enum(["cron", "interval", "once"])
      .optional()
      .describe("New schedule type"),
    schedule_value: z.string().optional().describe("New schedule value"),
  },
  async (args) => {
    if (args.schedule_type === "cron" && args.schedule_value) {
      try {
        CronExpressionParser.parse(args.schedule_value);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid cron: "${args.schedule_value}".`,
            },
          ],
          isError: true,
        };
      }
    }
    if (args.schedule_type === "interval" && args.schedule_value) {
      const ms = parseInt(args.schedule_value, 10);
      if (isNaN(ms) || ms <= 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid interval: "${args.schedule_value}".`,
            },
          ],
          isError: true,
        };
      }
    }

    const data: Record<string, string | undefined> = {
      type: "update_task",
      taskId: args.task_id,
      groupFolder,
      isMain: String(isMain),
      timestamp: new Date().toISOString(),
    };
    if (args.prompt !== undefined) data.prompt = args.prompt;
    if (args.schedule_type !== undefined)
      data.schedule_type = args.schedule_type;
    if (args.schedule_value !== undefined)
      data.schedule_value = args.schedule_value;

    writeIpcFile(TASKS_DIR, data);

    return {
      content: [
        {
          type: "text" as const,
          text: `Task ${args.task_id} update requested.`,
        },
      ],
    };
  },
);

server.tool(
  "register_group",
  "Register a new chat/group so the agent can respond to messages there. Main group only.",
  {
    jid: z.string().describe("The chat JID"),
    name: z.string().describe("Display name for the group"),
    folder: z
      .string()
      .describe(
        'Channel-prefixed folder name (e.g., "discord_general", "slack_dev-team")',
      ),
    trigger: z.string().describe('Trigger word (e.g., "@Nagi")'),
  },
  async (args) => {
    if (!isMain) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Only the main group can register new groups.",
          },
        ],
        isError: true,
      };
    }

    writeIpcFile(TASKS_DIR, {
      type: "register_group",
      jid: args.jid,
      name: args.name,
      folder: args.folder,
      trigger: args.trigger,
      timestamp: new Date().toISOString(),
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `Group "${args.name}" registered. It will start receiving messages immediately.`,
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
