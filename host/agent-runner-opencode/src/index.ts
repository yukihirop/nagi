/**
 * Nagi Agent Runner — Open Code variant
 *
 * Uses Open Code SDK (client-server architecture) instead of Claude Agent SDK.
 * Implements the same ContainerInput/ContainerOutput protocol so the orchestrator
 * can use either agent runner interchangeably.
 *
 * Stdin:  JSON ContainerInput
 * Stdout: OUTPUT_START_MARKER / OUTPUT_END_MARKER wrapped JSON results
 * IPC:   Follow-up messages via /workspace/ipc/input/
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createOpencode, type OpencodeClient } from "@opencode-ai/sdk";
import { setProviderAuth, extractToolInfo, getProviderID, extractCostInfo } from "./providers.js";

// --- Shared protocol types (same as Claude Code agent runner) ---

interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  mcpPlugins?: Array<{
    name: string;
    entryPoint: string;
    env?: Record<string, string>;
  }>;
  hooksConfig?: {
    postToolUse?: boolean;
    sessionStart?: boolean;
    skipTools?: string[];
  };
}

interface ContainerOutput {
  status: "success" | "error";
  result: string | null;
  newSessionId?: string;
  error?: string;
}

export const OUTPUT_START_MARKER = "---NAGI_OUTPUT_START---";
export const OUTPUT_END_MARKER = "---NAGI_OUTPUT_END---";

const IPC_INPUT_DIR = "/workspace/ipc/input";
const IPC_INPUT_CLOSE_SENTINEL = path.join(IPC_INPUT_DIR, "_close");
const IPC_POLL_MS = 500;

function writeOutput(output: ContainerOutput): void {
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

function log(message: string): void {
  console.error(`[agent-runner-opencode] ${message}`);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

// --- IPC helpers (same pattern as Claude Code runner) ---

function shouldClose(): boolean {
  return fs.existsSync(IPC_INPUT_CLOSE_SENTINEL);
}

function drainIpcInput(): string[] {
  const messages: string[] = [];
  if (!fs.existsSync(IPC_INPUT_DIR)) return messages;

  const files = fs
    .readdirSync(IPC_INPUT_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  for (const file of files) {
    try {
      const filepath = path.join(IPC_INPUT_DIR, file);
      const raw = fs.readFileSync(filepath, "utf-8");
      fs.unlinkSync(filepath);
      const data = JSON.parse(raw);
      if (data.type === "message" && typeof data.text === "string") {
        messages.push(data.text);
      }
    } catch {
      // skip
    }
  }
  return messages;
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

// --- Container plugin interface (same as Claude Code runner) ---

export interface ContainerPlugin {
  name: string;
  createHooks: (
    chatJid: string,
    groupFolder: string,
    hooksConfig: ContainerInput["hooksConfig"],
    log: (msg: string) => void,
  ) => Record<string, unknown>;
}

export interface RunConfig {
  containerPlugins?: ContainerPlugin[];
}

// --- MCP config builder ---

function buildMcpConfig(
  mcpServerPath: string,
  containerInput: ContainerInput,
): Record<string, { type: "local"; command: string[]; environment?: Record<string, string> }> {
  const mcp: Record<string, { type: "local"; command: string[]; environment?: Record<string, string> }> = {
    nagi: {
      type: "local" as const,
      command: ["node", mcpServerPath],
      environment: {
        NAGI_CHAT_JID: containerInput.chatJid,
        NAGI_GROUP_FOLDER: containerInput.groupFolder,
        NAGI_IS_MAIN: containerInput.isMain ? "1" : "0",
      },
    },
  };

  for (const plugin of containerInput.mcpPlugins ?? []) {
    mcp[plugin.name] = {
      type: "local" as const,
      command: ["node", plugin.entryPoint],
      ...(plugin.env ? { environment: plugin.env } : {}),
    };
  }

  return mcp;
}

// --- Main ---

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

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, "ipc-mcp-stdio.js");

  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
  try {
    fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL);
  } catch {
    /* ignore */
  }

  // Build plugin hooks
  const pluginHooks: Record<string, Array<{ hooks: Array<(input: Record<string, unknown>) => Promise<unknown>> }>> = {};
  for (const plugin of config?.containerPlugins ?? []) {
    const hooks = plugin.createHooks(
      containerInput.chatJid,
      containerInput.groupFolder,
      containerInput.hooksConfig,
      log,
    ) as Record<string, Array<{ hooks: Array<(input: Record<string, unknown>) => Promise<unknown>> }>>;
    Object.assign(pluginHooks, hooks);
  }

  // Determine model and provider from environment
  const model = process.env.OPENCODE_MODEL || "anthropic/claude-sonnet-4-20250514";
  const providerID = getProviderID(model);

  // Load group-level persona / instructions from /workspace/group.
  // The container entrypoint runs with cwd=/app, so opencode's native
  // AGENTS.md project-root discovery does NOT pick up /workspace/group/AGENTS.md
  // automatically. We pass AGENTS.md explicitly via `instructions`
  // so the group persona is always loaded regardless of cwd.
  // Note: Only AGENTS.md is loaded for Open Code; CLAUDE.md is reserved for
  // the Claude Code runner to avoid conflicting persona instructions.
  const groupInstructions: string[] = [];
  const groupBase = "/workspace/group";
  for (const candidate of ["AGENTS.md"]) {
    const filePath = path.join(groupBase, candidate);
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        groupInstructions.push(filePath);
      }
    } catch {
      /* skip unreadable entries */
    }
  }
  if (groupInstructions.length > 0) {
    log(
      `Loaded ${groupInstructions.length} group instruction file(s): ${groupInstructions.join(", ")}`,
    );
  }

  // Load extra context directories (mirrors Claude Code runner's extraDirs).
  // Each subdirectory under /workspace/extra — typically mounted from
  // deploy/{name}/container/context/{name}/ on the host — is scanned for
  // CLAUDE.md and AGENTS.md. Those files are passed to Open Code's
  // `instructions` config so they're appended to the system prompt. Combined
  // with the existing permission="allow" (which grants external_directory),
  // the agent can also Read/Grep other files inside these directories.
  const extraInstructions: string[] = [];
  const extraBase = "/workspace/extra";
  if (fs.existsSync(extraBase)) {
    for (const entry of fs.readdirSync(extraBase)) {
      const dirPath = path.join(extraBase, entry);
      try {
        if (!fs.statSync(dirPath).isDirectory()) continue;
      } catch {
        continue;
      }
      for (const candidate of ["CLAUDE.md", "AGENTS.md"]) {
        const filePath = path.join(dirPath, candidate);
        try {
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            extraInstructions.push(filePath);
          }
        } catch {
          /* skip unreadable entries */
        }
      }
    }
  }
  if (extraInstructions.length > 0) {
    log(
      `Loaded ${extraInstructions.length} extra instruction file(s): ${extraInstructions.join(", ")}`,
    );
  }

  // Group instructions come first so persona establishes the baseline; extra
  // context files are appended afterwards as supplemental reference material.
  const allInstructions = [...groupInstructions, ...extraInstructions];

  // Start Open Code server + client
  log(`Starting Open Code server (model: ${model})...`);

  let client: OpencodeClient;
  let serverHandle: { close: () => void } = { close: () => {} };

  try {
    const oc = await createOpencode({
      config: {
        model,
        mcp: buildMcpConfig(mcpServerPath, containerInput),
        ...(allInstructions.length > 0
          ? { instructions: allInstructions }
          : {}),
        // @ts-expect-error Open Code SDK types don't expose "allow" permission, but the server accepts it
        permission: "allow",
      },
    });
    client = oc.client;
    serverHandle = oc.server;
    log("Open Code server started");

    // Set provider API key
    await setProviderAuth(client, model, log);
  } catch (err) {
    writeOutput({
      status: "error",
      result: null,
      error: `Failed to start Open Code server: ${err instanceof Error ? err.message : String(err)}`,
    });
    process.exit(1);
  }

  let prompt = containerInput.prompt;
  if (containerInput.isScheduledTask) {
    prompt = `[SCHEDULED TASK]\n\n${prompt}`;
  }
  const pending = drainIpcInput();
  if (pending.length > 0) {
    log(`Draining ${pending.length} pending IPC messages into initial prompt`);
    prompt += "\n" + pending.join("\n");
  }

  // Always create a new session — Open Code server is fresh each container run
  // Previous session IDs are not resumable
  let sessionId: string | undefined;
  let lastProcessedMsgIndex = 0;

  try {
    while (true) {
      // Create or resume session
      if (!sessionId) {
        const session = await client.session.create({
          body: {},
        });
        const sessionData = session.data as Record<string, unknown>;
        sessionId = sessionData?.id as string;
        log(`New session created: ${sessionId}`);
      }

      log(`Sending prompt (session: ${sessionId}, ${prompt.length} chars)...`);

      // Fire SessionStart hooks
      const sessionStartHooks = pluginHooks["SessionStart"];
      if (sessionStartHooks) {
        for (const group of sessionStartHooks) {
          for (const hook of group.hooks) {
            try { await hook({ source: "opencode" }); } catch { /* ignore */ }
          }
        }
      }

      // Send prompt and wait for completion
      await client.session.prompt({
        path: { id: sessionId! },
        body: {
          parts: [{ type: "text", text: prompt }],
        },
      });

      log("Prompt completed, fetching result...");

      // Fetch messages to get the assistant's response
      let result: string | null = null;
      let costInfo: import("./providers.js").CostInfo | null = null;
      try {
        const messages = await client.session.messages({
          path: { id: sessionId! },
        });
        const msgList = (messages.data ?? []) as Array<{
          info?: { role?: string; error?: { name?: string; message?: string; data?: { message?: string } } };
          parts?: Array<{ type?: string; text?: string; toolName?: string }>;
        }>;

        const assistantMsgs = msgList.filter((m) => m.info?.role === "assistant");

        // Check for API errors in assistant messages
        const lastAssistantForError = assistantMsgs[assistantMsgs.length - 1];
        if (lastAssistantForError?.info?.error) {
          const err = lastAssistantForError.info.error;
          const errMsg = err.data?.message ?? err.message ?? err.name ?? "Unknown error";
          log(`API error detected: ${errMsg}`);
          result = `⚠️ ${err.name ?? "Error"}: ${errMsg}`;
        }

        // Fire PostToolUse hooks only for NEW messages since last prompt
        const postToolHooks = pluginHooks["PostToolUse"];
        let toolHooksFired = false;
        const newAssistantMsgs = assistantMsgs.slice(lastProcessedMsgIndex);
        for (const am of newAssistantMsgs) {
          for (const part of am.parts ?? []) {
            const p = part as Record<string, unknown>;
            const toolInfo = extractToolInfo(p, providerID);
            if (toolInfo) {
              const { toolName, toolInput } = toolInfo;
              if (postToolHooks) {
                for (const group of postToolHooks) {
                  for (const hook of group.hooks) {
                    try { await hook({ tool_name: toolName, tool_input: toolInput }); } catch { /* ignore */ }
                  }
                }
                toolHooksFired = true;
              }
            }
          }
        }
        lastProcessedMsgIndex = assistantMsgs.length;
        // Wait for IPC watcher to process tool notifications before sending result
        if (toolHooksFired) {
          await new Promise((r) => setTimeout(r, 1000));
        }

        // Collect text from last assistant message (skip if error already captured)
        const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
        if (!result && lastAssistant?.parts) {
          // Collect text, fall back to all assistant messages
          let textParts = lastAssistant.parts
            .filter((p) => p.type === "text" && p.text)
            .map((p) => p.text!);

          if (textParts.length === 0) {
            textParts = assistantMsgs
              .flatMap((m) => m.parts ?? [])
              .filter((p) => p.type === "text" && p.text)
              .map((p) => p.text!);
          }

          if (textParts.length > 0) {
            result = textParts[textParts.length - 1];
          }
        }

        // Extract cost info (provider-specific)
        costInfo = extractCostInfo(
          assistantMsgs as Array<Record<string, unknown>>,
          providerID,
        );
      } catch (err) {
        log(`Failed to fetch messages: ${err}`);
      }

      writeOutput({
        status: "success",
        result: result ?? "(no text response)",
        newSessionId: sessionId,
      });

      // Fire PromptComplete hooks (cost/model reporting)
      const promptCompleteHooks = pluginHooks["PromptComplete"];
      if (promptCompleteHooks) {
        for (const group of promptCompleteHooks) {
          for (const hook of group.hooks) {
            try { await hook({ cost: costInfo, provider: providerID, model }); } catch { /* ignore */ }
          }
        }
      }

      if (shouldClose()) {
        log("Close sentinel detected, exiting");
        break;
      }

      log("Prompt done, waiting for next IPC message...");

      const nextMessage = await waitForIpcMessage();
      if (nextMessage === null) {
        log("Close sentinel received, exiting");
        break;
      }

      log(`Got new message (${nextMessage.length} chars), sending new prompt`);
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
  } finally {
    // Backup Open Code session data before shutdown
    const backupDir = "/workspace/opencode-backup";
    const sourceDir = "/home/node/.local/share/opencode";
    try {
      if (fs.existsSync(sourceDir) && fs.existsSync(backupDir)) {
        fs.cpSync(sourceDir, backupDir, { recursive: true });
        log(`Session data backed up to ${backupDir}`);
      }
    } catch (err) {
      log(`Failed to backup session data: ${err}`);
    }

    log("Shutting down Open Code server...");
    serverHandle.close();
  }
}

// Only auto-run when executed directly (not when imported by entry.ts)
const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url).endsWith(
    process.argv[1].replace(/.*\/dist\//, "dist/"),
  );
if (isDirectRun) {
  run();
}
