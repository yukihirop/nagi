import fs from "node:fs";
import path from "node:path";

import { createLogger } from "@nagi/logger";
import { readEnvFile, type ResolvedConfig } from "@nagi/config";
import { detectAuthMode } from "@nagi/credential-proxy";
import type { RegisteredGroup } from "@nagi/types";

import { CONTAINER_HOST_GATEWAY } from "../container-runtime.js";
import type { AgentConfig, VolumeMount } from "./agent-config.js";

const logger = createLogger({ name: "orchestrator" });

export const claudeCodeConfig: AgentConfig = {
  sessionSubdir: ".claude",
  sessionContainerPath: "/home/node/.claude",
  agentRunnerPkg: "agent-runner-claudecode",
  agentRunnerDirName: "agent-runner-claudecode-src",
  agentType: "claude-code",

  initSessionDir(sessionDir: string, config: ResolvedConfig, group: RegisteredGroup): void {
    const settingsFile = path.join(sessionDir, "settings.json");
    const baseSettings: Record<string, unknown> = {
      env: {
        CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1",
        CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: "1",
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: "0",
      },
    };
    // Load group settings.json if it exists (e.g. groups/slack/main/settings.json)
    const rootDir = path.resolve(config.paths.dataDir, "..");
    const groupSettingsFile = path.join(rootDir, "groups", group.channel, group.folder, "settings.json");
    if (fs.existsSync(groupSettingsFile)) {
      try {
        const groupSettings = JSON.parse(fs.readFileSync(groupSettingsFile, "utf-8")) as Record<string, unknown>;
        if (typeof groupSettings.env === "object" && groupSettings.env !== null) {
          baseSettings.env = { ...(baseSettings.env as Record<string, string>), ...(groupSettings.env as Record<string, string>) };
        }
        if (groupSettings.hooks) {
          baseSettings.hooks = groupSettings.hooks;
        }
      } catch {
        logger.warn({ path: groupSettingsFile }, "Failed to parse group settings.json");
      }
    }
    fs.writeFileSync(settingsFile, JSON.stringify(baseSettings, null, 2) + "\n");
  },

  additionalMounts(): VolumeMount[] {
    return [];
  },

  buildEnvArgs(config: ResolvedConfig): string[] {
    const args: string[] = [];
    args.push(
      "-e",
      `ANTHROPIC_BASE_URL=http://${CONTAINER_HOST_GATEWAY}:${config.container.credentialProxyPort}`,
    );
    const authMode = detectAuthMode();
    if (authMode === "api-key") {
      args.push("-e", "ANTHROPIC_API_KEY=placeholder");
    } else {
      args.push("-e", "CLAUDE_CODE_OAUTH_TOKEN=placeholder");
    }
    return args;
  },
};
