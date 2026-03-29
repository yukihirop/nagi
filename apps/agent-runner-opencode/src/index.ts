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

// --- SSE event processing ---

async function processEvents(
  client: OpencodeClient,
  sessionId: string,
  promptDone: Promise<unknown>,
  containerInput: ContainerInput,
  pluginHooks: Record<string, Array<{ hooks: Array<(input: Record<string, unknown>) => Promise<unknown>> }>>,
): Promise<{ result: string | null; error: string | null }> {
  const events = await client.event.subscribe();
  let result: string | null = null;
  let error: string | null = null;
  let finished = false;

  promptDone.then(() => {
    finished = true;
  });

  for await (const event of events.stream) {
    const evt = event as { type: string; properties?: Record<string, unknown> };

    switch (evt.type) {
      case "session.created":
      case "session.updated": {
        // Fire SessionStart hooks
        if (evt.type === "session.created") {
          log(`Session event: ${evt.type}`);
          const sessionStartHooks = pluginHooks["SessionStart"];
          if (sessionStartHooks) {
            for (const group of sessionStartHooks) {
              for (const hook of group.hooks) {
                try {
                  await hook({ source: "opencode" });
                } catch (err) {
                  log(`SessionStart hook error: ${err}`);
                }
              }
            }
          }
        }
        break;
      }

      case "message.part.updated": {
        const props = evt.properties as Record<string, unknown> | undefined;
        const partType = props?.type as string | undefined;

        // Detect tool use for PostToolUse hooks
        if (partType === "tool-invocation" || partType === "tool-result") {
          const toolName = (props?.toolName as string) ?? "unknown";
          log(`Tool event: ${toolName} (${partType})`);

          if (partType === "tool-result") {
            const postToolHooks = pluginHooks["PostToolUse"];
            if (postToolHooks) {
              for (const group of postToolHooks) {
                for (const hook of group.hooks) {
                  try {
                    await hook({
                      tool_name: toolName,
                      tool_input: props?.args ?? {},
                    });
                  } catch (err) {
                    log(`PostToolUse hook error: ${err}`);
                  }
                }
              }
            }
          }
        }
        break;
      }

      case "session.idle": {
        log("Session idle — agent finished responding");
        // Fetch the last assistant message to get the result
        try {
          const messages = await client.session.messages({
            path: { id: sessionId },
          });
          const msgList = (messages.data ?? []) as Array<{
            role?: string;
            parts?: Array<{ type?: string; text?: string }>;
          }>;
          const lastAssistant = [...msgList]
            .reverse()
            .find((m) => m.role === "assistant");
          if (lastAssistant?.parts) {
            const textParts = lastAssistant.parts
              .filter((p) => p.type === "text" && p.text)
              .map((p) => p.text!);
            if (textParts.length > 0) {
              result = textParts.join("\n");
            }
          }
        } catch (err) {
          log(`Failed to fetch messages: ${err}`);
        }
        break;
      }

      case "session.error": {
        const props = evt.properties as Record<string, unknown> | undefined;
        error = (props?.message as string) ?? "Unknown session error";
        log(`Session error: ${error}`);
        break;
      }
    }

    if (finished) break;
  }

  return { result, error };
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

  // Determine model from environment
  const model = process.env.OPENCODE_MODEL || "anthropic/claude-sonnet-4-20250514";

  // Start Open Code server + client
  log(`Starting Open Code server (model: ${model})...`);

  let client: OpencodeClient;
  let serverHandle: { close: () => void };

  try {
    const oc = await createOpencode({
      config: {
        model,
        mcp: buildMcpConfig(mcpServerPath, containerInput),
        // Auto-approve all tool permissions (running in container)
        permission: {
          "*": true,
        } as Record<string, unknown>,
      },
    });
    client = oc.client;
    serverHandle = oc.server;
    log("Open Code server started");

    // Set provider API key
    const providerID = model.split("/")[0];
    const apiKeyMap: Record<string, string | undefined> = {
      openrouter: process.env.OPENROUTER_API_KEY,
      google: process.env.GOOGLE_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
    };
    const apiKey = apiKeyMap[providerID];
    if (apiKey) {
      await client.auth.set({
        path: { id: providerID },
        body: { type: "api" as const, key: apiKey },
      });
      log(`API key set for provider: ${providerID}`);
    } else {
      log(`Warning: No API key found for provider ${providerID}`);
    }
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

  try {
    while (true) {
      // Create or resume session
      if (!sessionId) {
        const session = await client.session.create({
          body: {},
        });
        sessionId = (session.data as { id: string })?.id;
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
      try {
        const messages = await client.session.messages({
          path: { id: sessionId! },
        });
        const msgList = (messages.data ?? []) as Array<{
          info?: { role?: string };
          parts?: Array<{ type?: string; text?: string; toolName?: string }>;
        }>;

        const assistantMsgs = msgList.filter((m) => m.info?.role === "assistant");

        // Fire PostToolUse hooks for any tool uses
        const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
        if (lastAssistant?.parts) {
          const postToolHooks = pluginHooks["PostToolUse"];
          if (postToolHooks) {
            for (const part of lastAssistant.parts) {
              if (part.type === "tool-invocation" && part.toolName) {
                for (const group of postToolHooks) {
                  for (const hook of group.hooks) {
                    try { await hook({ tool_name: part.toolName, tool_input: {} }); } catch { /* ignore */ }
                  }
                }
              }
            }
          }

          // Collect text from last assistant message first, fall back to all
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
      } catch (err) {
        log(`Failed to fetch messages: ${err}`);
      }

      if (result) {
        writeOutput({
          status: "success",
          result,
          newSessionId: sessionId,
        });
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
