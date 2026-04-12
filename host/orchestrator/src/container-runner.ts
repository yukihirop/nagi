/**
 * Container Runner for Nagi
 * Spawns agent execution in containers and handles IPC
 */
import { ChildProcess, exec, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createLogger } from "@nagi/logger";
import { readEnvFile, type ResolvedConfig } from "@nagi/config";
import type { RegisteredGroup, MountAllowlist } from "@nagi/types";
import { validateAdditionalMounts } from "@nagi/auth";

import {
  CONTAINER_RUNTIME_BIN,
  hostGatewayArgs,
  readonlyMountArgs,
  stopContainer,
} from "./container-runtime.js";
import { resolveAgentConfig } from "./container-runner-configs/agent-config.js";
import {
  resolveGroupFolderPath,
  resolveGroupIpcPath,
} from "./group-folder.js";

const logger = createLogger({ name: "orchestrator" });

const OUTPUT_START_MARKER = "---NAGI_OUTPUT_START---";
const OUTPUT_END_MARKER = "---NAGI_OUTPUT_END---";

export interface ContainerInput {
  prompt: string;
  sessionId?: string;
  channel: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  mcpPlugins?: Array<{ name: string; entryPoint: string; env?: Record<string, string> }>;
  hooksConfig?: { postToolUse?: boolean; sessionStart?: boolean; skipTools?: string[] };
}

export interface ContainerOutput {
  status: "success" | "error";
  result: string | null;
  newSessionId?: string;
  error?: string;
}

interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readonly: boolean;
}

export function buildVolumeMounts(
  group: RegisteredGroup,
  isMain: boolean,
  config: ResolvedConfig,
  mountAllowlist?: MountAllowlist | null,
): VolumeMount[] {
  const mounts: VolumeMount[] = [];
  const projectRoot = process.cwd();
  const groupDir = resolveGroupFolderPath(config.paths.groupsDir, group.channel, group.folder);

  if (isMain) {
    mounts.push({
      hostPath: projectRoot,
      containerPath: "/workspace/project",
      readonly: true,
    });

    const envFile = path.join(projectRoot, ".env");
    if (fs.existsSync(envFile)) {
      mounts.push({
        hostPath: "/dev/null",
        containerPath: "/workspace/project/.env",
        readonly: true,
      });
    }

    mounts.push({
      hostPath: groupDir,
      containerPath: "/workspace/group",
      readonly: false,
    });
  } else {
    mounts.push({
      hostPath: groupDir,
      containerPath: "/workspace/group",
      readonly: false,
    });

    const globalDir = path.join(config.paths.groupsDir, "global");
    if (fs.existsSync(globalDir)) {
      mounts.push({
        hostPath: globalDir,
        containerPath: "/workspace/global",
        readonly: true,
      });
    }
  }

  // Resolve agent-specific config based on container image
  const agentConfig = resolveAgentConfig(config.container.image);

  // Per-group sessions directory
  const groupSessionsDir = path.join(
    config.paths.dataDir,
    "sessions",
    group.channel,
    group.folder,
    agentConfig.sessionSubdir,
  );
  fs.mkdirSync(groupSessionsDir, { recursive: true });
  agentConfig.initSessionDir(groupSessionsDir, config, group);

  // Sync skills
  const skillsSrc = path.join(process.cwd(), "container", "skills");
  const skillsDst = path.join(groupSessionsDir, "skills");
  if (fs.existsSync(skillsSrc)) {
    for (const skillDir of fs.readdirSync(skillsSrc)) {
      const srcDir = path.join(skillsSrc, skillDir);
      if (!fs.statSync(srcDir).isDirectory()) continue;
      const dstDir = path.join(skillsDst, skillDir);
      fs.cpSync(srcDir, dstDir, { recursive: true });
    }
  }
  mounts.push({
    hostPath: groupSessionsDir,
    containerPath: agentConfig.sessionContainerPath,
    readonly: false,
  });

  // Agent-specific additional mounts
  mounts.push(...agentConfig.additionalMounts(config, group));

  // Container plugins — shared (MCP plugins)
  const sharedPluginsDir = path.join(process.cwd(), "container", "plugins");
  if (fs.existsSync(sharedPluginsDir)) {
    mounts.push({
      hostPath: sharedPluginsDir,
      containerPath: "/app/plugins",
      readonly: true,
    });
  }

  // Container plugins — agent-specific (e.g. agent-hooks)
  const agentPluginsDir = path.join(process.cwd(), "container", agentConfig.agentType, "plugins");
  if (fs.existsSync(agentPluginsDir)) {
    mounts.push({
      hostPath: agentPluginsDir,
      containerPath: "/app/agent-plugins",
      readonly: true,
    });
  }

  // Context mounts — developer-managed additional directories.
  // Placed at deploy/{name}/container/context/{name}/ on host and exposed at
  // /workspace/extra/{name}/ inside the container. The Claude Code agent-runner
  // picks these up automatically via /workspace/extra scanning and passes them
  // as additionalDirectories to the SDK. CLAUDE.md in each dir is auto-appended
  // to the system prompt because CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1.
  const contextBase = path.join(
    config.paths.deployDir,
    "container",
    "context",
  );
  if (fs.existsSync(contextBase)) {
    for (const entry of fs.readdirSync(contextBase)) {
      const hostPath = path.join(contextBase, entry);
      let entryStat: fs.Stats;
      try {
        entryStat = fs.statSync(hostPath);
      } catch {
        continue;
      }
      if (!entryStat.isDirectory()) continue;
      mounts.push({
        hostPath,
        containerPath: `/workspace/extra/${entry}`,
        readonly: true,
      });
    }
  }

  // Per-group IPC namespace
  const groupIpcDir = resolveGroupIpcPath(config.paths.dataDir, group.channel, group.folder);
  fs.mkdirSync(path.join(groupIpcDir, "messages"), { recursive: true });
  fs.mkdirSync(path.join(groupIpcDir, "tasks"), { recursive: true });
  fs.mkdirSync(path.join(groupIpcDir, "input"), { recursive: true });
  mounts.push({
    hostPath: groupIpcDir,
    containerPath: "/workspace/ipc",
    readonly: false,
  });

  // Per-group agent-runner source
  const agentRunnerSrc = path.join(
    projectRoot,
    "host",
    agentConfig.agentRunnerPkg,
    "src",
  );
  const groupAgentRunnerDir = path.join(
    config.paths.dataDir,
    "sessions",
    group.channel,
    group.folder,
    agentConfig.agentRunnerDirName,
  );
  if (fs.existsSync(agentRunnerSrc)) {
    // Clean stale files from previous agent type before copying
    if (fs.existsSync(groupAgentRunnerDir)) {
      fs.rmSync(groupAgentRunnerDir, { recursive: true });
    }
    fs.cpSync(agentRunnerSrc, groupAgentRunnerDir, { recursive: true });
  }
  // Copy container/{agent}/entry.ts into agent-runner source
  const containerEntryPath = path.join(config.paths.deployDir, "container", agentConfig.agentType, "entry.ts");
  if (fs.existsSync(containerEntryPath)) {
    fs.copyFileSync(containerEntryPath, path.join(groupAgentRunnerDir, "entry.ts"));
  }
  mounts.push({
    hostPath: groupAgentRunnerDir,
    containerPath: "/app/src",
    readonly: false,
  });

  // Validate and add additional mounts from group config
  if (group.containerConfig?.additionalMounts && mountAllowlist) {
    const validatedMounts = validateAdditionalMounts(
      group.containerConfig.additionalMounts,
      mountAllowlist,
      group.name,
      isMain,
    );
    mounts.push(...validatedMounts);
  } else if (group.containerConfig?.additionalMounts && !mountAllowlist) {
    logger.warn(
      { group: group.name, mountCount: group.containerConfig.additionalMounts.length },
      "Additional mounts BLOCKED — no mount allowlist configured. Use orchestrator.setMountAllowlist() in entry.ts",
    );
  }

  return mounts;
}

export function buildContainerArgs(
  mounts: VolumeMount[],
  containerName: string,
  config: ResolvedConfig,
): string[] {
  const args: string[] = ["run", "-i", "--rm", "--name", containerName];

  args.push("-e", `TZ=${config.timezone}`);

  // Agent-specific environment variables
  const agentConfig = resolveAgentConfig(config.container.image);
  args.push(...agentConfig.buildEnvArgs(config));

  const envSecrets = readEnvFile(["VERCEL_API_TOKEN", "YOUTUBE_API_KEY"]);
  if (envSecrets.VERCEL_API_TOKEN) {
    args.push("-e", `VERCEL_API_TOKEN=${envSecrets.VERCEL_API_TOKEN}`);
  }
  if (envSecrets.YOUTUBE_API_KEY) {
    args.push("-e", `YOUTUBE_API_KEY=${envSecrets.YOUTUBE_API_KEY}`);
  }

  const maxTurns = process.env.MAX_AGENT_TURNS;
  if (maxTurns) {
    args.push("-e", `MAX_AGENT_TURNS=${maxTurns}`);
  }

  args.push(...hostGatewayArgs());

  const hostUid = process.getuid?.();
  const hostGid = process.getgid?.();
  if (hostUid != null && hostUid !== 0 && hostUid !== 1000) {
    args.push("--user", `${hostUid}:${hostGid}`);
    args.push("-e", "HOME=/home/node");
  }

  for (const mount of mounts) {
    if (mount.readonly) {
      args.push(...readonlyMountArgs(mount.hostPath, mount.containerPath));
    } else {
      args.push("-v", `${mount.hostPath}:${mount.containerPath}`);
    }
  }

  args.push(config.container.image);

  return args;
}

export async function runContainerAgent(
  group: RegisteredGroup,
  input: ContainerInput,
  config: ResolvedConfig,
  onProcess: (proc: ChildProcess, containerName: string) => void,
  onOutput?: (output: ContainerOutput) => Promise<void>,
  mountAllowlist?: MountAllowlist | null,
): Promise<ContainerOutput> {
  const startTime = Date.now();

  const groupDir = resolveGroupFolderPath(config.paths.groupsDir, group.channel, group.folder);
  fs.mkdirSync(groupDir, { recursive: true });

  const mounts = buildVolumeMounts(group, input.isMain, config, mountAllowlist);
  const safeChannel = group.channel.replace(/[^a-zA-Z0-9-]/g, "-");
  const safeFolder = group.folder.replace(/[^a-zA-Z0-9-]/g, "-");
  const containerName = `nagi-${safeChannel}-${safeFolder}-${Date.now()}`;
  const containerArgs = buildContainerArgs(mounts, containerName, config);

  logger.debug(
    {
      group: group.name,
      containerName,
      mounts: mounts.map(
        (m) =>
          `${m.hostPath} -> ${m.containerPath}${m.readonly ? " (ro)" : ""}`,
      ),
    },
    "Container mount configuration",
  );

  logger.info(
    {
      group: group.name,
      containerName,
      mountCount: mounts.length,
      isMain: input.isMain,
    },
    "Spawning container agent",
  );

  const logsDir = path.join(groupDir, "logs");
  fs.mkdirSync(logsDir, { recursive: true });

  return new Promise((resolve) => {
    const container = spawn(CONTAINER_RUNTIME_BIN, containerArgs, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    onProcess(container, containerName);

    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    const maxOutputSize = config.container.maxOutputSize;

    container.stdin.write(JSON.stringify(input));
    container.stdin.end();

    let parseBuffer = "";
    let newSessionId: string | undefined;
    let outputChain = Promise.resolve();
    let hadStreamingOutput = false;

    container.stdout.on("data", (data) => {
      const chunk = data.toString();

      if (!stdoutTruncated) {
        const remaining = maxOutputSize - stdout.length;
        if (chunk.length > remaining) {
          stdout += chunk.slice(0, remaining);
          stdoutTruncated = true;
          logger.warn(
            { group: group.name, size: stdout.length },
            "Container stdout truncated",
          );
        } else {
          stdout += chunk;
        }
      }

      if (onOutput) {
        parseBuffer += chunk;
        let startIdx: number;
        while (
          (startIdx = parseBuffer.indexOf(OUTPUT_START_MARKER)) !== -1
        ) {
          const endIdx = parseBuffer.indexOf(OUTPUT_END_MARKER, startIdx);
          if (endIdx === -1) break;

          const jsonStr = parseBuffer
            .slice(startIdx + OUTPUT_START_MARKER.length, endIdx)
            .trim();
          parseBuffer = parseBuffer.slice(endIdx + OUTPUT_END_MARKER.length);

          try {
            const parsed: ContainerOutput = JSON.parse(jsonStr);
            if (parsed.newSessionId) {
              newSessionId = parsed.newSessionId;
            }
            hadStreamingOutput = true;
            resetTimeout();
            outputChain = outputChain.then(() => onOutput(parsed));
          } catch (err) {
            logger.warn(
              { group: group.name, error: err },
              "Failed to parse streamed output chunk",
            );
          }
        }
      }
    });

    container.stderr.on("data", (data) => {
      const chunk = data.toString();
      const lines = chunk.trim().split("\n");
      for (const line of lines) {
        if (!line) continue;
        logger.debug({ container: group.folder }, line);
      }
      if (stderrTruncated) return;
      const remaining = maxOutputSize - stderr.length;
      if (chunk.length > remaining) {
        stderr += chunk.slice(0, remaining);
        stderrTruncated = true;
      } else {
        stderr += chunk;
      }
    });

    let timedOut = false;
    const configTimeout =
      group.containerConfig?.timeout || config.container.timeout;
    const timeoutMs = Math.max(
      configTimeout,
      config.container.idleTimeout + 30_000,
    );

    const killOnTimeout = () => {
      timedOut = true;
      logger.error(
        { group: group.name, containerName },
        "Container timeout, stopping gracefully",
      );
      exec(stopContainer(containerName), { timeout: 15000 }, (err) => {
        if (err) {
          logger.warn(
            { group: group.name, containerName, err },
            "Graceful stop failed, force killing",
          );
          container.kill("SIGKILL");
        }
      });
    };

    let timeout = setTimeout(killOnTimeout, timeoutMs);

    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(killOnTimeout, timeoutMs);
    };

    container.on("close", (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      if (timedOut) {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const timeoutLog = path.join(logsDir, `container-${ts}.json`);
        fs.writeFileSync(
          timeoutLog,
          JSON.stringify({
            timestamp: new Date().toISOString(),
            group: group.name,
            container: containerName,
            duration,
            exitCode: code,
            hadStreamingOutput,
            timeout: true,
          }, null, 2),
        );

        if (hadStreamingOutput) {
          logger.info(
            { group: group.name, containerName, duration, code },
            "Container timed out after output (idle cleanup)",
          );
          outputChain.then(() => {
            resolve({ status: "success", result: null, newSessionId });
          });
          return;
        }

        resolve({
          status: "error",
          result: null,
          error: `Container timed out after ${configTimeout}ms`,
        });
        return;
      }

      // Write log file
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const logFile = path.join(logsDir, `container-${timestamp}.json`);
      const isVerbose =
        process.env.LOG_LEVEL === "debug" ||
        process.env.LOG_LEVEL === "trace";
      const isError = code !== 0;

      const logData: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        group: group.name,
        isMain: input.isMain,
        duration,
        exitCode: code,
        sessionId: input.sessionId || null,
      };

      if (isVerbose || isError) {
        logData.promptLength = input.prompt.length;
        logData.stderr = stderr;
        logData.stderrTruncated = stderrTruncated;
      }

      fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));

      if (code !== 0) {
        logger.error(
          { group: group.name, code, duration, logFile },
          "Container exited with error",
        );
        resolve({
          status: "error",
          result: null,
          error: `Container exited with code ${code}: ${stderr.slice(-200)}`,
        });
        return;
      }

      if (onOutput) {
        outputChain.then(() => {
          logger.info(
            { group: group.name, duration, newSessionId },
            "Container completed (streaming mode)",
          );
          resolve({ status: "success", result: null, newSessionId });
        });
        return;
      }

      // Legacy mode: parse output markers from stdout
      try {
        const startIdx = stdout.indexOf(OUTPUT_START_MARKER);
        const endIdx = stdout.indexOf(OUTPUT_END_MARKER);

        let jsonLine: string;
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonLine = stdout
            .slice(startIdx + OUTPUT_START_MARKER.length, endIdx)
            .trim();
        } else {
          const lines = stdout.trim().split("\n");
          jsonLine = lines[lines.length - 1];
        }

        const output: ContainerOutput = JSON.parse(jsonLine);
        logger.info(
          { group: group.name, duration, status: output.status },
          "Container completed",
        );
        resolve(output);
      } catch (err) {
        logger.error(
          { group: group.name, error: err },
          "Failed to parse container output",
        );
        resolve({
          status: "error",
          result: null,
          error: `Failed to parse container output: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });

    container.on("error", (err) => {
      clearTimeout(timeout);
      logger.error(
        { group: group.name, containerName, error: err },
        "Container spawn error",
      );
      resolve({
        status: "error",
        result: null,
        error: `Container spawn error: ${err.message}`,
      });
    });
  });
}

export function writeTasksSnapshot(
  dataDir: string,
  channel: string,
  groupFolder: string,
  isMain: boolean,
  tasks: Array<{
    id: string;
    groupFolder: string;
    prompt: string;
    schedule_type: string;
    schedule_value: string;
    status: string;
    next_run: string | null;
  }>,
): void {
  const groupIpcDir = resolveGroupIpcPath(dataDir, channel, groupFolder);
  fs.mkdirSync(groupIpcDir, { recursive: true });

  const filteredTasks = isMain
    ? tasks
    : tasks.filter((t) => t.groupFolder === groupFolder);

  const tasksFile = path.join(groupIpcDir, "current_tasks.json");
  fs.writeFileSync(tasksFile, JSON.stringify(filteredTasks, null, 2));
}

export interface AvailableGroup {
  jid: string;
  name: string;
  lastActivity: string;
  isRegistered: boolean;
}

export function writeGroupsSnapshot(
  dataDir: string,
  channel: string,
  groupFolder: string,
  isMain: boolean,
  groups: AvailableGroup[],
): void {
  const groupIpcDir = resolveGroupIpcPath(dataDir, channel, groupFolder);
  fs.mkdirSync(groupIpcDir, { recursive: true });

  const visibleGroups = isMain ? groups : [];

  const groupsFile = path.join(groupIpcDir, "available_groups.json");
  fs.writeFileSync(
    groupsFile,
    JSON.stringify(
      { groups: visibleGroups, lastSync: new Date().toISOString() },
      null,
      2,
    ),
  );
}
