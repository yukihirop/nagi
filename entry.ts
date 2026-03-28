import { loadConfig, readEnvFile } from "@nagi/config";
import { createLogger, setupGlobalErrorHandlers } from "@nagi/logger";
import { ChannelRegistry } from "@nagi/channel-core";
import { Orchestrator } from "@nagi/orchestrator";

const logger = createLogger({ name: "nagi" });
setupGlobalErrorHandlers(logger);

const config = loadConfig();
const registry = new ChannelRegistry();

// Register Slack if configured
const slackEnv = readEnvFile(["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"]);
if (slackEnv.SLACK_BOT_TOKEN && slackEnv.SLACK_APP_TOKEN) {
  const { createSlackFactory } = await import("@nagi/channel-slack");
  registry.register(
    "slack",
    createSlackFactory({
      botToken: slackEnv.SLACK_BOT_TOKEN,
      appToken: slackEnv.SLACK_APP_TOKEN,
      assistantName: config.assistantName,
      triggerPattern: config.triggerPattern,
    }),
  );
  logger.info("Slack channel registered");
}

// Register Discord if configured
const discordEnv = readEnvFile(["DISCORD_BOT_TOKEN"]);
if (discordEnv.DISCORD_BOT_TOKEN) {
  const { createDiscordFactory } = await import("@nagi/channel-discord");
  registry.register(
    "discord",
    createDiscordFactory({
      botToken: discordEnv.DISCORD_BOT_TOKEN,
      assistantName: config.assistantName,
      triggerPattern: config.triggerPattern,
    }),
  );
  logger.info("Discord channel registered");
}

const orchestrator = new Orchestrator(config, registry);

// Register MCP plugins (available inside agent containers)
orchestrator.registerMcpPlugin("ollama", {
  entryPoint: "/app/mcp-plugins/ollama/dist/index.js",
});

const vercelEnv = readEnvFile(["VERCEL_API_TOKEN"]);
if (vercelEnv.VERCEL_API_TOKEN) {
  orchestrator.registerMcpPlugin("vercel", {
    entryPoint: "/app/mcp-plugins/vercel/dist/index.js",
    env: { VERCEL_API_TOKEN: vercelEnv.VERCEL_API_TOKEN },
  });
}

// Register agent hooks (PostToolUse / SessionStart notifications to chat)
import { defaultHooksConfig } from "@nagi/agent-hooks-claude-code";
orchestrator.registerHooksPlugin(defaultHooksConfig());

// Mount security — configure which host directories containers can access
// Uncomment and customize to enable additional mounts:
//
// orchestrator.setMountAllowlist({
//   allowedRoots: [
//     { path: "~/projects", allowReadWrite: true, description: "Dev projects" },
//     { path: "~/Documents", allowReadWrite: false, description: "Read-only docs" },
//   ],
//   blockedPatterns: ["password", "secret"],
//   nonMainReadOnly: true,
// });

process.on("SIGTERM", async () => {
  await orchestrator.shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await orchestrator.shutdown();
  process.exit(0);
});

await orchestrator.start();
