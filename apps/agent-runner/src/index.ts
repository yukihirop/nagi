/**
 * Nagi Agent Runner
 * Runs inside a container, receives config via stdin, outputs result to stdout
 *
 * Input protocol:
 *   Stdin: Full ContainerInput JSON (read until EOF)
 *   IPC:   Follow-up messages written as JSON files to /workspace/ipc/input/
 *          Files: {type:"message", text:"..."}.json — polled and consumed
 *          Sentinel: /workspace/ipc/input/_close — signals session end
 *
 * Stdout protocol:
 *   Each result is wrapped in OUTPUT_START_MARKER / OUTPUT_END_MARKER pairs.
 *   Multiple results may be emitted (one per agent teams result).
 */

import fs from "fs";
import path from "path";
import {
  query,
  type HookCallback,
  type PreCompactHookInput,
} from "@anthropic-ai/claude-agent-sdk";
import { fileURLToPath } from "url";

interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  mcpPlugins?: Array<{ name: string; entryPoint: string; env?: Record<string, string> }>;
  hooksConfig?: { postToolUse?: boolean; sessionStart?: boolean; skipTools?: string[] };
}

interface ContainerOutput {
  status: "success" | "error";
  result: string | null;
  newSessionId?: string;
  error?: string;
}

interface SessionEntry {
  sessionId: string;
  fullPath: string;
  summary: string;
  firstPrompt: string;
}

interface SessionsIndex {
  entries: SessionEntry[];
}

interface SDKUserMessage {
  type: "user";
  message: { role: "user"; content: string };
  parent_tool_use_id: null;
  session_id: string;
}

const IPC_INPUT_DIR = "/workspace/ipc/input";
const IPC_INPUT_CLOSE_SENTINEL = path.join(IPC_INPUT_DIR, "_close");
const IPC_POLL_MS = 500;

export const OUTPUT_START_MARKER = "---NAGI_OUTPUT_START---";
export const OUTPUT_END_MARKER = "---NAGI_OUTPUT_END---";

/**
 * Push-based async iterable for streaming user messages to the SDK.
 * Keeps the iterable alive until end() is called, preventing isSingleUserTurn.
 */
class MessageStream {
  private queue: SDKUserMessage[] = [];
  private waiting: (() => void) | null = null;
  private done = false;

  push(text: string): void {
    this.queue.push({
      type: "user",
      message: { role: "user", content: text },
      parent_tool_use_id: null,
      session_id: "",
    });
    this.waiting?.();
  }

  end(): void {
    this.done = true;
    this.waiting?.();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
    while (true) {
      while (this.queue.length > 0) {
        yield this.queue.shift()!;
      }
      if (this.done) return;
      await new Promise<void>((r) => {
        this.waiting = r;
      });
      this.waiting = null;
    }
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function writeOutput(output: ContainerOutput): void {
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

function log(message: string): void {
  console.error(`[agent-runner] ${message}`);
}

function getSessionSummary(
  sessionId: string,
  transcriptPath: string,
): string | null {
  const projectDir = path.dirname(transcriptPath);
  const indexPath = path.join(projectDir, "sessions-index.json");

  if (!fs.existsSync(indexPath)) {
    log(`Sessions index not found at ${indexPath}`);
    return null;
  }

  try {
    const index: SessionsIndex = JSON.parse(
      fs.readFileSync(indexPath, "utf-8"),
    );
    const entry = index.entries.find((e) => e.sessionId === sessionId);
    if (entry?.summary) {
      return entry.summary;
    }
  } catch (err) {
    log(
      `Failed to read sessions index: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return null;
}

export interface ContainerPlugin {
  name: string;
  createHooks: (
    chatJid: string,
    groupFolder: string,
    hooksConfig: ContainerInput["hooksConfig"],
    log: (msg: string) => void,
  ) => Record<string, Array<{ hooks: HookCallback[] }>>;
}

export interface RunConfig {
  containerPlugins?: ContainerPlugin[];
}

function createPreCompactHook(assistantName?: string): HookCallback {
  return async (input, _toolUseId, _context) => {
    const preCompact = input as PreCompactHookInput;
    const transcriptPath = preCompact.transcript_path;
    const sessionId = preCompact.session_id;

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      log("No transcript found for archiving");
      return {};
    }

    try {
      const content = fs.readFileSync(transcriptPath, "utf-8");
      const messages = parseTranscript(content);

      if (messages.length === 0) {
        log("No messages to archive");
        return {};
      }

      const summary = getSessionSummary(sessionId, transcriptPath);
      const name = summary
        ? sanitizeFilename(summary)
        : generateFallbackName();

      const conversationsDir = "/workspace/group/conversations";
      fs.mkdirSync(conversationsDir, { recursive: true });

      const date = new Date().toISOString().split("T")[0];
      const filename = `${date}-${name}.md`;
      const filePath = path.join(conversationsDir, filename);

      const markdown = formatTranscriptMarkdown(
        messages,
        summary,
        assistantName,
      );
      fs.writeFileSync(filePath, markdown);

      log(`Archived conversation to ${filePath}`);
    } catch (err) {
      log(
        `Failed to archive transcript: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {};
  };
}

function sanitizeFilename(summary: string): string {
  return summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function generateFallbackName(): string {
  const time = new Date();
  return `conversation-${time.getHours().toString().padStart(2, "0")}${time.getMinutes().toString().padStart(2, "0")}`;
}

interface ParsedMessage {
  role: "user" | "assistant";
  content: string;
}

function parseTranscript(content: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === "user" && entry.message?.content) {
        const text =
          typeof entry.message.content === "string"
            ? entry.message.content
            : entry.message.content
                .map((c: { text?: string }) => c.text || "")
                .join("");
        if (text) messages.push({ role: "user", content: text });
      } else if (entry.type === "assistant" && entry.message?.content) {
        const textParts = entry.message.content
          .filter((c: { type: string }) => c.type === "text")
          .map((c: { text: string }) => c.text);
        const text = textParts.join("");
        if (text) messages.push({ role: "assistant", content: text });
      }
    } catch {
      // skip malformed lines
    }
  }

  return messages;
}

function formatTranscriptMarkdown(
  messages: ParsedMessage[],
  title?: string | null,
  assistantName?: string,
): string {
  const now = new Date();
  const formatDateTime = (d: Date) =>
    d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const lines: string[] = [];
  lines.push(`# ${title || "Conversation"}`);
  lines.push("");
  lines.push(`Archived: ${formatDateTime(now)}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const msg of messages) {
    const sender =
      msg.role === "user" ? "User" : (assistantName || "Assistant");
    const content =
      msg.content.length > 2000
        ? msg.content.slice(0, 2000) + "..."
        : msg.content;
    lines.push(`**${sender}**: ${content}`);
    lines.push("");
  }

  return lines.join("\n");
}

function shouldClose(): boolean {
  if (fs.existsSync(IPC_INPUT_CLOSE_SENTINEL)) {
    try {
      fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL);
    } catch {
      /* ignore */
    }
    return true;
  }
  return false;
}

function drainIpcInput(): string[] {
  try {
    fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
    const files = fs
      .readdirSync(IPC_INPUT_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort();

    const messages: string[] = [];
    for (const file of files) {
      const filePath = path.join(IPC_INPUT_DIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        fs.unlinkSync(filePath);
        if (data.type === "message" && data.text) {
          messages.push(data.text);
        }
      } catch (err) {
        log(
          `Failed to process input file ${file}: ${err instanceof Error ? err.message : String(err)}`,
        );
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
      }
    }
    return messages;
  } catch (err) {
    log(
      `IPC drain error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

function waitForIpcMessage(): Promise<string | null> {
  return new Promise((resolve) => {
    const poll = () => {
      if (shouldClose()) {
        resolve(null);
        return;
      }
      const messages = drainIpcInput();
      if (messages.length > 0) {
        resolve(messages.join("\n"));
        return;
      }
      setTimeout(poll, IPC_POLL_MS);
    };
    poll();
  });
}

async function runQuery(
  prompt: string,
  sessionId: string | undefined,
  mcpServerPath: string,
  containerInput: ContainerInput,
  sdkEnv: Record<string, string | undefined>,
  resumeAt?: string,
  containerPlugins?: ContainerPlugin[],
): Promise<{
  newSessionId?: string;
  lastAssistantUuid?: string;
  closedDuringQuery: boolean;
  lastResult?: string;
}> {
  const stream = new MessageStream();
  stream.push(prompt);
  let lastResult: string | undefined;

  let ipcPolling = true;
  let closedDuringQuery = false;
  const pollIpcDuringQuery = () => {
    if (!ipcPolling) return;
    if (shouldClose()) {
      log("Close sentinel detected during query, ending stream");
      closedDuringQuery = true;
      stream.end();
      ipcPolling = false;
      return;
    }
    // Don't pipe IPC messages into active queries — hooks (PostToolUse, etc.)
    // don't fire for piped follow-up turns. Instead, let the query complete
    // and process follow-ups as new queries with fresh hooks.
    setTimeout(pollIpcDuringQuery, IPC_POLL_MS);
  };
  setTimeout(pollIpcDuringQuery, IPC_POLL_MS);

  let newSessionId: string | undefined;
  let lastAssistantUuid: string | undefined;
  let messageCount = 0;
  let resultCount = 0;
  const maxTurns = parseInt(process.env.MAX_AGENT_TURNS || "50", 10);

  const globalClaudeMdPath = "/workspace/global/CLAUDE.md";
  let globalClaudeMd: string | undefined;
  if (!containerInput.isMain && fs.existsSync(globalClaudeMdPath)) {
    globalClaudeMd = fs.readFileSync(globalClaudeMdPath, "utf-8");
  }

  const extraDirs: string[] = [];
  const extraBase = "/workspace/extra";
  if (fs.existsSync(extraBase)) {
    for (const entry of fs.readdirSync(extraBase)) {
      const fullPath = path.join(extraBase, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        extraDirs.push(fullPath);
      }
    }
  }
  if (extraDirs.length > 0) {
    log(`Additional directories: ${extraDirs.join(", ")}`);
  }

  // Build plugin hooks
  const pluginHooks: Record<string, Array<{ hooks: HookCallback[] }>> = {};
  for (const plugin of containerPlugins ?? []) {
    const hooks = plugin.createHooks(containerInput.chatJid, containerInput.groupFolder, containerInput.hooksConfig, log);
    Object.assign(pluginHooks, hooks);
  }

  for await (const message of query({
    prompt: stream,
    options: {
      cwd: "/workspace/group",
      additionalDirectories: extraDirs.length > 0 ? extraDirs : undefined,
      resume: sessionId,
      resumeSessionAt: resumeAt,
      systemPrompt: globalClaudeMd
        ? {
            type: "preset" as const,
            preset: "claude_code" as const,
            append: globalClaudeMd,
          }
        : undefined,
      allowedTools: [
        "Bash",
        "Read",
        "Write",
        "Edit",
        "Glob",
        "Grep",
        "WebSearch",
        "WebFetch",
        "Task",
        "TaskOutput",
        "TaskStop",
        "TeamCreate",
        "TeamDelete",
        "SendMessage",
        "TodoWrite",
        "ToolSearch",
        "Skill",
        "NotebookEdit",
        "mcp__nagi__*",
        // Dynamically add MCP plugin tool patterns
        ...(containerInput.mcpPlugins || []).map((p) => `mcp__${p.name}__*`),
      ],
      env: sdkEnv,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      settingSources: ["project", "user"],
      mcpServers: {
        nagi: {
          command: "node",
          args: [mcpServerPath],
          env: {
            NAGI_CHAT_JID: containerInput.chatJid,
            NAGI_GROUP_FOLDER: containerInput.groupFolder,
            NAGI_IS_MAIN: containerInput.isMain ? "1" : "0",
          },
        },
        // Dynamically register MCP plugins
        ...Object.fromEntries(
          (containerInput.mcpPlugins || []).map((p) => [
            p.name,
            {
              command: "node",
              args: [p.entryPoint],
              env: p.env,
            },
          ]),
        ),
      },
      hooks: {
        PreCompact: [
          { hooks: [createPreCompactHook(containerInput.assistantName)] },
        ],
        ...pluginHooks,
      },
    },
  })) {
    messageCount++;
    const msgType =
      message.type === "system"
        ? `system/${(message as { subtype?: string }).subtype}`
        : message.type;
    log(`[msg #${messageCount}] type=${msgType}`);

    if (messageCount >= maxTurns) {
      log(`Max turns reached (${maxTurns}), stopping agent`);
      writeOutput({
        status: "error",
        result: `Agent stopped after ${maxTurns} turns. The task may be too complex or in a loop.`,
        newSessionId,
      });
      stream.end();
      break;
    }

    if (message.type === "assistant" && "uuid" in message) {
      lastAssistantUuid = (message as { uuid: string }).uuid;
    }

    if (message.type === "system" && message.subtype === "init") {
      newSessionId = message.session_id;
      log(`Session initialized: ${newSessionId}`);
    }

    if (
      message.type === "system" &&
      (message as { subtype?: string }).subtype === "task_notification"
    ) {
      const tn = message as {
        task_id: string;
        status: string;
        summary: string;
      };
      log(
        `Task notification: task=${tn.task_id} status=${tn.status} summary=${tn.summary}`,
      );
    }

    if (message.type === "result") {
      resultCount++;
      const textResult =
        "result" in message
          ? (message as { result?: string }).result
          : null;
      log(
        `Result #${resultCount}: subtype=${message.subtype}${textResult ? ` text=${textResult.slice(0, 200)}` : ""}`,
      );
      // Buffer the last result with text content — only write after query completes
      // to avoid duplicate outputs when SDK emits multiple result messages
      if (textResult) {
        lastResult = textResult;
      }
    }
  }

  ipcPolling = false;
  log(
    `Query done. Messages: ${messageCount}, results: ${resultCount}, lastAssistantUuid: ${lastAssistantUuid || "none"}, closedDuringQuery: ${closedDuringQuery}`,
  );
  return { newSessionId, lastAssistantUuid, closedDuringQuery, lastResult };
}

export async function run(config?: RunConfig): Promise<void> {
  let containerInput: ContainerInput;

  try {
    const stdinData = await readStdin();
    containerInput = JSON.parse(stdinData);
    try {
      fs.unlinkSync("/tmp/input.json");
    } catch {
      /* may not exist */
    }
    log(`Received input for group: ${containerInput.groupFolder}`);
  } catch (err) {
    writeOutput({
      status: "error",
      result: null,
      error: `Failed to parse input: ${err instanceof Error ? err.message : String(err)}`,
    });
    process.exit(1);
  }

  const sdkEnv: Record<string, string | undefined> = {
    ...process.env,
    NAGI_CHAT_JID: containerInput.chatJid,
    NAGI_GROUP_FOLDER: containerInput.groupFolder,
  };

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, "ipc-mcp-stdio.js");

  let sessionId = containerInput.sessionId;
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });

  try {
    fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL);
  } catch {
    /* ignore */
  }

  let prompt = containerInput.prompt;
  if (containerInput.isScheduledTask) {
    prompt = `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n${prompt}`;
  }
  const pending = drainIpcInput();
  if (pending.length > 0) {
    log(
      `Draining ${pending.length} pending IPC messages into initial prompt`,
    );
    prompt += "\n" + pending.join("\n");
  }

  let resumeAt: string | undefined;
  try {
    while (true) {
      log(
        `Starting query (session: ${sessionId || "new"}, resumeAt: ${resumeAt || "latest"})...`,
      );

      const queryResult = await runQuery(
        prompt,
        sessionId,
        mcpServerPath,
        containerInput,
        sdkEnv,
        resumeAt,
        config?.containerPlugins,
      );
      if (queryResult.newSessionId) {
        sessionId = queryResult.newSessionId;
      }
      if (queryResult.lastAssistantUuid) {
        resumeAt = queryResult.lastAssistantUuid;
      }

      if (queryResult.lastResult) {
        writeOutput({
          status: "success",
          result: queryResult.lastResult,
          newSessionId: sessionId,
        });
      }

      if (queryResult.closedDuringQuery) {
        log("Close sentinel consumed during query, exiting");
        break;
      }

      log("Query ended, waiting for next IPC message...");

      const nextMessage = await waitForIpcMessage();
      if (nextMessage === null) {
        log("Close sentinel received, exiting");
        break;
      }

      log(`Got new message (${nextMessage.length} chars), starting new query`);
      prompt = nextMessage;
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Agent error: ${errorMessage}`);
    writeOutput({
      status: "error",
      result: null,
      newSessionId: sessionId,
      error: errorMessage,
    });
    process.exit(1);
  }
}

run();
