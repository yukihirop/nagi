// Type stub for IDE resolution — at runtime, entry.ts is copied into the
// agent-runner source directory where the real index.ts lives.

export interface ContainerPlugin {
  name: string;
  createHooks: (
    chatJid: string,
    groupFolder: string,
    hooksConfig: { postToolUse?: boolean; sessionStart?: boolean; promptComplete?: boolean; skipTools?: string[] } | undefined,
    log: (msg: string) => void,
  ) => Record<string, unknown>;
}

export interface RunConfig {
  containerPlugins?: ContainerPlugin[];
}

export function run(config?: RunConfig): Promise<void>;
