// IMPORTANT: This file is intentionally duplicated per agent (claude-code / open-code).
// Each agent's plugin wiring may diverge independently — sharing with conditional branches
// tends to cause subtle bugs. Keep copies in sync manually where applicable.
import { run, type ContainerPlugin } from "./index.js";

type HookCallback = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;

/** Type for agent-hooks plugin loaded via dynamic import */
interface AgentHooksModule {
  createPostToolUseHook: (chatJid: string, groupFolder: string, skipTools: string[] | undefined, log: (msg: string) => void) => HookCallback;
  createSessionStartHook: (chatJid: string, groupFolder: string, log: (msg: string) => void) => HookCallback;
  createPromptCompleteHook: (chatJid: string, groupFolder: string, log: (msg: string) => void) => HookCallback;
}

// Load container plugins dynamically
const plugins: ContainerPlugin[] = [];

try {
  const pluginPath = "/app/agent-plugins/agent-hooks/index.mjs";
  const agentHooks = await import(/* webpackIgnore: true */ pluginPath) as AgentHooksModule;

  plugins.push({
    name: "agent-hooks",
    createHooks: (
      chatJid: string,
      groupFolder: string,
      hooksConfig: { postToolUse?: boolean; sessionStart?: boolean; promptComplete?: boolean; skipTools?: string[] } | undefined,
      log: (msg: string) => void,
    ) => ({
      ...(hooksConfig?.postToolUse !== false ? {
        PostToolUse: [{ hooks: [agentHooks.createPostToolUseHook(chatJid, groupFolder, hooksConfig?.skipTools, log)] }],
      } : {}),
      ...(hooksConfig?.sessionStart !== false ? {
        SessionStart: [{ hooks: [agentHooks.createSessionStartHook(chatJid, groupFolder, log)] }],
      } : {}),
      ...(hooksConfig?.promptComplete !== false ? {
        PromptComplete: [{ hooks: [agentHooks.createPromptCompleteHook(chatJid, groupFolder, log)] }],
      } : {}),
    }),
  });
} catch {
  // Plugin not available, skip
}

await run({ containerPlugins: plugins });
