import path from "node:path";
import { loadConfig, readEnvFile } from "@nagi/config";
import { createLogger, setupGlobalErrorHandlers } from "@nagi/logger";
import { ChannelRegistry } from "@nagi/channel-core";
import { Orchestrator } from "@nagi/orchestrator";

// Derive deploy directory from this file's location (deploy/{name}/host/entry.ts)
const deployDir = path.resolve(import.meta.dirname, "..");
const envPath = path.join(deployDir, ".env");

const logger = createLogger({ name: "nagi" });
setupGlobalErrorHandlers(logger);

const config = loadConfig({ envPath });
const registry = new ChannelRegistry();

// Register Slack if configured (defaults to Block Kit Embed rich display;
// switch to "@nagi/channel-slack-block-kit" or "@nagi/channel-slack" to downgrade)
const slackEnv = readEnvFile(["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"], envPath);
if (slackEnv.SLACK_BOT_TOKEN && slackEnv.SLACK_APP_TOKEN) {
  const { createSlackFactory } = await import("@nagi/channel-slack-block-kit-embed");
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

// Register Discord if configured (defaults to Embed rich display;
// switch to "@nagi/channel-discord" to downgrade to plain text)
const discordEnv = readEnvFile(["DISCORD_BOT_TOKEN"], envPath);
if (discordEnv.DISCORD_BOT_TOKEN) {
  const { createDiscordFactory } = await import("@nagi/channel-discord-embed");
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

// Register Asana if configured
const asanaEnv = readEnvFile(
  [
    "ASANA_PAT",
    "ASANA_USER_GID",
    "ASANA_PROJECT_GIDS",
    "ASANA_POLL_INTERVAL_MS",
  ],
  envPath,
);
if (asanaEnv.ASANA_PAT && asanaEnv.ASANA_PROJECT_GIDS) {
  const { createAsanaFactory } = await import("@nagi/channel-asana");
  const projectGids = asanaEnv.ASANA_PROJECT_GIDS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const pollIntervalMs = asanaEnv.ASANA_POLL_INTERVAL_MS
    ? Number(asanaEnv.ASANA_POLL_INTERVAL_MS)
    : undefined;
  registry.register(
    "asana",
    createAsanaFactory({
      personalAccessToken: asanaEnv.ASANA_PAT,
      userGid: asanaEnv.ASANA_USER_GID || undefined,
      projectGids,
      assistantName: config.assistantName,
      triggerPattern: config.triggerPattern,
      pollIntervalMs,
      stateDir: config.paths.dataDir,
    }),
  );
  logger.info(
    { projects: projectGids.length },
    "Asana channel registered",
  );
}

const orchestrator = new Orchestrator(config, registry);

// Register MCP plugins (available inside agent containers)
orchestrator.registerMcpPlugin("ollama", {
  entryPoint: "/app/mcp-plugins/ollama/dist/index.js",
});

const vercelEnv = readEnvFile(["VERCEL_API_TOKEN"], envPath);
if (vercelEnv.VERCEL_API_TOKEN) {
  orchestrator.registerMcpPlugin("vercel", {
    entryPoint: "/app/mcp-plugins/vercel/dist/index.js",
    env: { VERCEL_API_TOKEN: vercelEnv.VERCEL_API_TOKEN },
  });
}

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
