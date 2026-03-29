/**
 * Nagi Agent Runner — Open Code variant
 *
 * This agent runner uses Open Code SDK instead of Claude Agent SDK.
 * It implements the same ContainerInput/ContainerOutput protocol as the
 * Claude Code agent runner, so the orchestrator can use either interchangeably.
 *
 * Stdin:  JSON ContainerInput (prompt, sessionId, groupFolder, chatJid, etc.)
 * Stdout: OUTPUT_START_MARKER / OUTPUT_END_MARKER wrapped JSON results
 * IPC:   Follow-up messages written as JSON files to /workspace/ipc/input/
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Shared types — same protocol as Claude Code agent runner
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

  // TODO: Phase 2 — Integrate Open Code SDK
  //
  // Open Code uses a client-server architecture:
  // 1. Start Open Code server (managed mode via SDK)
  // 2. Connect SDK client to server
  // 3. Send prompt and receive streaming responses
  // 4. Handle tool execution events for hooks
  // 5. Manage session persistence
  //
  // For now, output a placeholder response indicating Open Code is not yet implemented.

  log("Open Code agent runner is a skeleton — SDK integration pending (Phase 2)");

  writeOutput({
    status: "error",
    result: null,
    error:
      "Open Code agent runner is not yet implemented. " +
      "This is a Phase 1 skeleton — SDK integration will be added in Phase 2.",
  });
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
