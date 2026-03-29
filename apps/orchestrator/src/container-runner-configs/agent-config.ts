import type { ResolvedConfig } from "@nagi/config";
import type { RegisteredGroup } from "@nagi/types";

export interface VolumeMount {
  hostPath: string;
  containerPath: string;
  readonly: boolean;
}

export interface AgentConfig {
  /** Session subdirectory name (.claude or .opencode) */
  sessionSubdir: string;
  /** Container path for session mount */
  sessionContainerPath: string;
  /** agent-runner package name */
  agentRunnerPkg: string;
  /** agent-runner-src directory name */
  agentRunnerDirName: string;
  /** container/ agent directory name */
  agentType: string;
  /** Initialize session directory (e.g. settings.json merge) */
  initSessionDir(sessionDir: string, config: ResolvedConfig, group: RegisteredGroup): void;
  /** Agent-specific additional mounts */
  additionalMounts(config: ResolvedConfig, group: RegisteredGroup): VolumeMount[];
  /** Agent-specific environment variable args */
  buildEnvArgs(config: ResolvedConfig): string[];
}

import { claudeCodeConfig } from "./claude-code.js";
import { openCodeConfig } from "./open-code.js";

export function resolveAgentConfig(image: string): AgentConfig {
  const imageName = image.split(":")[0];
  if (imageName.endsWith("-opencode")) {
    return openCodeConfig;
  }
  return claudeCodeConfig;
}
