#!/usr/bin/env node
/**
 * Nagi CLI — Run agent prompts from the terminal
 *
 * Usage:
 *   nagi "prompt"              Run prompt in main group
 *   nagi -g <group> "prompt"   Run in specific group
 *   nagi -s <session> "prompt" Resume session
 *   nagi --list                List registered groups
 *   echo "prompt" | nagi       Pipe input
 */

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadConfig, readEnvFile } from "@nagi/config";
import { createDatabase } from "@nagi/db";
import type { RegisteredGroup } from "@nagi/types";

const OUTPUT_START = "---NAGI_OUTPUT_START---";
const OUTPUT_END = "---NAGI_OUTPUT_END---";

interface CliArgs {
  prompt: string;
  group: string | null;
  sessionId: string | null;
  list: boolean;
  verbose: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    prompt: "",
    group: null,
    sessionId: null,
    list: false,
    verbose: false,
  };

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-g" || arg === "--group") {
      result.group = args[++i];
    } else if (arg === "-s" || arg === "--session") {
      result.sessionId = args[++i];
    } else if (arg === "--list" || arg === "-l") {
      result.list = true;
    } else if (arg === "-v" || arg === "--verbose") {
      result.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      positional.push(arg);
    }
  }

  result.prompt = positional.join(" ");
  return result;
}

function printUsage(): void {
  console.log(`
nagi — Run agent prompts from the terminal

Usage:
  nagi "prompt"                Run prompt in main group
  nagi -g <group> "prompt"     Run in specific group (name or folder)
  nagi -s <session> "prompt"   Resume a previous session
  nagi --list                  List registered groups
  echo "prompt" | nagi         Pipe input

Options:
  -g, --group <name>    Target group (default: main)
  -s, --session <id>    Resume session ID
  -l, --list            List registered groups
  -v, --verbose         Show container details
  -h, --help            Show this help
`);
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data.trim()));
  });
}

function findGroup(
  groups: Record<string, RegisteredGroup>,
  query: string | null,
): { jid: string; group: RegisteredGroup } | null {
  if (!query) {
    // Default: find main group
    for (const [jid, group] of Object.entries(groups)) {
      if (group.isMain) return { jid, group };
    }
    // Fallback: group with folder "main"
    for (const [jid, group] of Object.entries(groups)) {
      if (group.folder === "main") return { jid, group };
    }
    return null;
  }

  // Exact JID match
  if (groups[query]) return { jid: query, group: groups[query] };

  // Match by folder or name (case-insensitive)
  const lower = query.toLowerCase();
  for (const [jid, group] of Object.entries(groups)) {
    if (
      group.folder.toLowerCase() === lower ||
      group.name.toLowerCase() === lower
    ) {
      return { jid, group };
    }
  }

  // Fuzzy match
  for (const [jid, group] of Object.entries(groups)) {
    if (
      group.folder.toLowerCase().includes(lower) ||
      group.name.toLowerCase().includes(lower)
    ) {
      return { jid, group };
    }
  }

  return null;
}

function detectRuntime(): string {
  // Check Apple Container on macOS 15+
  if (os.platform() === "darwin") {
    try {
      execSync("which container", { stdio: "pipe" });
      return "container";
    } catch {
      // fall through
    }
  }
  return "docker";
}

async function main(): Promise<void> {
  const args = parseArgs();
  const config = loadConfig();

  const dbPath = path.join(config.paths.dataDir, "store", "messages.db");
  if (!fs.existsSync(dbPath)) {
    console.error("Database not found. Run /setup first.");
    process.exit(1);
  }

  const db = createDatabase({ path: dbPath });
  const groups = db.groups.getAll();

  // List mode
  if (args.list) {
    const entries = Object.entries(groups);
    if (entries.length === 0) {
      console.log("No registered groups.");
    } else {
      console.log("Registered groups:\n");
      for (const [jid, group] of entries) {
        const main = group.isMain ? " (main)" : "";
        console.log(`  ${group.folder}${main}`);
        console.log(`    name: ${group.name}`);
        console.log(`    jid:  ${jid}`);
        console.log(`    trigger: ${group.trigger}`);
        console.log();
      }
    }
    db.close();
    process.exit(0);
  }

  // Get prompt
  let prompt = args.prompt;
  if (!prompt) {
    prompt = await readStdin();
  }
  if (!prompt) {
    console.error("No prompt provided. Usage: nagi \"your prompt\"");
    db.close();
    process.exit(1);
  }

  // Find target group
  const match = findGroup(groups, args.group);
  if (!match) {
    console.error(
      args.group
        ? `Group "${args.group}" not found. Use --list to see available groups.`
        : "No main group registered. Use /add-channel-slack to register a group.",
    );
    db.close();
    process.exit(1);
  }

  const { jid, group } = match;
  const isMain = group.isMain === true;

  // Get session (detect agent type from container image)
  const imageName = config.container.image.split(":")[0];
  const agentType = imageName.endsWith("-opencode") ? "open-code" : "claude-code";
  const groupKey = `${group.channel}/${group.folder}`;
  const sessionId = args.sessionId || db.sessions.get(groupKey, agentType);

  db.close();

  // Read secrets from .env
  const secrets = readEnvFile([
    "CLAUDE_CODE_OAUTH_TOKEN",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "VERCEL_API_TOKEN",
    "YOUTUBE_API_KEY",
    "OLLAMA_HOST",
  ]);

  // Build container input
  const input = {
    prompt,
    sessionId,
    groupFolder: group.folder,
    chatJid: jid,
    isMain,
    assistantName: config.assistantName,
  };

  // Build container args
  const runtime = detectRuntime();
  const groupDir = path.join(config.paths.groupsDir, group.folder);
  fs.mkdirSync(groupDir, { recursive: true });

  const sessionsDir = path.join(
    config.paths.dataDir,
    "sessions",
    group.folder,
    ".claude",
  );
  fs.mkdirSync(sessionsDir, { recursive: true });

  const ipcDir = path.join(config.paths.dataDir, "ipc", group.folder);
  fs.mkdirSync(path.join(ipcDir, "messages"), { recursive: true });
  fs.mkdirSync(path.join(ipcDir, "tasks"), { recursive: true });
  fs.mkdirSync(path.join(ipcDir, "input"), { recursive: true });

  const agentRunnerSrc = path.join(process.cwd(), "apps", "agent-runner", "src");
  const groupAgentDir = path.join(
    config.paths.dataDir,
    "sessions",
    group.folder,
    "agent-runner-src",
  );
  if (!fs.existsSync(groupAgentDir) && fs.existsSync(agentRunnerSrc)) {
    fs.cpSync(agentRunnerSrc, groupAgentDir, { recursive: true });
  }

  const containerName = `nagi-cli-${Date.now()}`;
  const containerArgs = ["run", "-i", "--rm", "--name", containerName];

  // Environment
  containerArgs.push("-e", `TZ=${config.timezone}`);

  // Direct API access (no credential proxy in CLI mode)
  if (secrets.ANTHROPIC_BASE_URL) {
    containerArgs.push(
      "-e",
      `ANTHROPIC_BASE_URL=${secrets.ANTHROPIC_BASE_URL}`,
    );
  }
  if (secrets.ANTHROPIC_API_KEY) {
    containerArgs.push("-e", `ANTHROPIC_API_KEY=${secrets.ANTHROPIC_API_KEY}`);
  } else if (secrets.CLAUDE_CODE_OAUTH_TOKEN) {
    containerArgs.push(
      "-e",
      `CLAUDE_CODE_OAUTH_TOKEN=${secrets.CLAUDE_CODE_OAUTH_TOKEN}`,
    );
  } else if (secrets.ANTHROPIC_AUTH_TOKEN) {
    containerArgs.push(
      "-e",
      `ANTHROPIC_AUTH_TOKEN=${secrets.ANTHROPIC_AUTH_TOKEN}`,
    );
  }
  if (secrets.VERCEL_API_TOKEN) {
    containerArgs.push(
      "-e",
      `VERCEL_API_TOKEN=${secrets.VERCEL_API_TOKEN}`,
    );
  }
  if (secrets.YOUTUBE_API_KEY) {
    containerArgs.push("-e", `YOUTUBE_API_KEY=${secrets.YOUTUBE_API_KEY}`);
  }
  if (secrets.OLLAMA_HOST) {
    containerArgs.push("-e", `OLLAMA_HOST=${secrets.OLLAMA_HOST}`);
  }

  // Host gateway (Linux)
  if (os.platform() === "linux") {
    containerArgs.push("--add-host=host.docker.internal:host-gateway");
  }

  // User mapping
  const uid = process.getuid?.();
  const gid = process.getgid?.();
  if (uid != null && uid !== 0 && uid !== 1000) {
    containerArgs.push("--user", `${uid}:${gid}`);
    containerArgs.push("-e", "HOME=/home/node");
  }

  // Mounts
  containerArgs.push("-v", `${groupDir}:/workspace/group`);
  containerArgs.push("-v", `${sessionsDir}:/home/node/.claude`);
  containerArgs.push("-v", `${ipcDir}:/workspace/ipc`);
  containerArgs.push("-v", `${groupAgentDir}:/app/src`);

  if (isMain) {
    containerArgs.push("-v", `${process.cwd()}:/workspace/project:ro`);
    const envFile = path.join(process.cwd(), ".env");
    if (fs.existsSync(envFile)) {
      containerArgs.push("-v", "/dev/null:/workspace/project/.env:ro");
    }
  } else {
    const globalDir = path.join(config.paths.groupsDir, "global");
    if (fs.existsSync(globalDir)) {
      containerArgs.push("-v", `${globalDir}:/workspace/global:ro`);
    }
  }

  containerArgs.push(config.container.image);

  if (args.verbose) {
    console.error(`[nagi] Group: ${group.name} (${group.folder})`);
    console.error(`[nagi] JID: ${jid}`);
    console.error(`[nagi] Session: ${sessionId || "new"}`);
    console.error(`[nagi] Runtime: ${runtime}`);
    console.error(`[nagi] Container: ${containerName}`);
  }

  // Spawn container
  const container = spawn(runtime, containerArgs, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  container.stdin.write(JSON.stringify(input));
  container.stdin.end();

  // Parse output
  let buffer = "";
  let result: string | null = null;
  let newSessionId: string | null = null;

  container.stdout.on("data", (data) => {
    buffer += data.toString();

    let startIdx: number;
    while ((startIdx = buffer.indexOf(OUTPUT_START)) !== -1) {
      const endIdx = buffer.indexOf(OUTPUT_END, startIdx);
      if (endIdx === -1) break;

      const jsonStr = buffer
        .slice(startIdx + OUTPUT_START.length, endIdx)
        .trim();
      buffer = buffer.slice(endIdx + OUTPUT_END.length);

      try {
        const output = JSON.parse(jsonStr);
        if (output.result) {
          result = output.result;
          process.stdout.write(output.result);
          if (!output.result.endsWith("\n")) {
            process.stdout.write("\n");
          }
        }
        if (output.newSessionId) {
          newSessionId = output.newSessionId;
        }
        if (output.error) {
          console.error(`[nagi] Error: ${output.error}`);
        }
      } catch {
        // skip malformed output
      }
    }
  });

  container.stderr.on("data", (data) => {
    if (args.verbose) {
      for (const line of data.toString().trim().split("\n")) {
        if (line) console.error(`[container] ${line}`);
      }
    }
  });

  container.on("close", (code) => {
    if (newSessionId) {
      console.error(`[nagi] session: ${newSessionId}`);
    }

    if (code !== 0 && !result) {
      console.error(`[nagi] Container exited with code ${code}`);
      process.exit(1);
    }
  });

  container.on("error", (err) => {
    console.error(`[nagi] Failed to start container: ${err.message}`);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(`[nagi] ${err.message}`);
  process.exit(1);
});
