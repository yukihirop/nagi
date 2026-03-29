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
    ]);
    if (opencodeEnv.OPENCODE_MODEL) {
      args.push("-e", `OPENCODE_MODEL=${opencodeEnv.OPENCODE_MODEL}`);
    }
    if (opencodeEnv.OPENROUTER_API_KEY) {
      args.push("-e", `OPENROUTER_API_KEY=${opencodeEnv.OPENROUTER_API_KEY}`);
    }
    if (opencodeEnv.GOOGLE_API_KEY) {
      args.push("-e", `GOOGLE_API_KEY=${opencodeEnv.GOOGLE_API_KEY}`);
    }
    if (opencodeEnv.OPENAI_API_KEY) {
      args.push("-e", `OPENAI_API_KEY=${opencodeEnv.OPENAI_API_KEY}`);
    }
    return args;
  },
};
