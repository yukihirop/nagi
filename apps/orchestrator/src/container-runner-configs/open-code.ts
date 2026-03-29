import fs from "node:fs";
import path from "node:path";

import { readEnvFile, type ResolvedConfig } from "@nagi/config";
import type { RegisteredGroup } from "@nagi/types";

import type { AgentConfig, VolumeMount } from "./agent-config.js";

export const openCodeConfig: AgentConfig = {
  sessionSubdir: ".opencode",
  sessionContainerPath: "/home/node/.opencode",
  agentRunnerPkg: "agent-runner-opencode",
  agentRunnerDirName: "agent-runner-opencode-src",
  agentType: "open-code",

  initSessionDir(): void {
    // No session initialization needed for Open Code
  },

  additionalMounts(config: ResolvedConfig, group: RegisteredGroup): VolumeMount[] {
    // Backup directory for Open Code session data (for UI viewing)
    const openCodeBackupDir = path.join(
      config.paths.dataDir,
      "sessions",
      group.folder,
      ".opencode-data",
    );
    fs.mkdirSync(openCodeBackupDir, { recursive: true });
    return [
      {
        hostPath: openCodeBackupDir,
        containerPath: "/workspace/opencode-backup",
        readonly: false,
      },
    ];
  },

  buildEnvArgs(): string[] {
    const args: string[] = [];
    const opencodeEnv = readEnvFile([
      "OPENCODE_MODEL",
      "OPENROUTER_API_KEY",
      "GOOGLE_API_KEY",
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
    ]);

    const model = opencodeEnv.OPENCODE_MODEL || "anthropic/claude-sonnet-4-20250514";
    args.push("-e", `OPENCODE_MODEL=${model}`);

    // Only pass the API key for the active provider
    const providerID = model.split("/")[0];
    const PROVIDER_KEY: Record<string, string> = {
      openrouter: "OPENROUTER_API_KEY",
      google: "GOOGLE_API_KEY",
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
    };
    const envKey = PROVIDER_KEY[providerID];
    if (envKey) {
      const value = opencodeEnv[envKey as keyof typeof opencodeEnv];
      if (value) {
        args.push("-e", `${envKey}=${value}`);
      }
    }

    return args;
  },
};
