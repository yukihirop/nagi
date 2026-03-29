import { run } from "./index.js";

// Load container plugins dynamically
const plugins = [];

try {
  const pluginPath = "/app/agent-plugins/agent-hooks/index.mjs";
  const agentHooks = await import(/* webpackIgnore: true */ pluginPath);

  plugins.push({
    name: "agent-hooks",
    createHooks: (
      chatJid: string,
      groupFolder: string,
      hooksConfig: { postToolUse?: boolean; sessionStart?: boolean; skipTools?: string[] } | undefined,
      log: (msg: string) => void,
    ) => ({
      ...(hooksConfig?.postToolUse !== false ? {
        PostToolUse: [{ hooks: [agentHooks.createPostToolUseHook(chatJid, groupFolder, hooksConfig?.skipTools, log)] }],
      } : {}),
      ...(hooksConfig?.sessionStart !== false ? {
        SessionStart: [{ hooks: [agentHooks.createSessionStartHook(chatJid, groupFolder, log)] }],
      } : {}),
    }),
  });
} catch {
  // Plugin not available, skip
}

await run({ containerPlugins: plugins });
