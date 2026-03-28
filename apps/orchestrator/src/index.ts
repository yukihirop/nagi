import { loadConfig } from "@nagi/config";
import { createLogger, setupGlobalErrorHandlers } from "@nagi/logger";
import { ChannelRegistry } from "@nagi/channel-core";
import { Orchestrator } from "./orchestrator.js";

export { Orchestrator } from "./orchestrator.js";
export { AppState } from "./state.js";
export type { ContainerInput, ContainerOutput } from "./container-runner.js";

const logger = createLogger({ name: "orchestrator" });

async function main(): Promise<void> {
  setupGlobalErrorHandlers(logger);

  const config = loadConfig();
  const channelRegistry = new ChannelRegistry();

  // Channels are registered by the app that imports this package.
  // Example:
  //   import { createDiscordFactory } from "@nagi/channel-discord";
  //   channelRegistry.register("discord", createDiscordFactory({ botToken: "..." }));

  const orchestrator = new Orchestrator(config, channelRegistry);

  process.on("SIGTERM", async () => {
    await orchestrator.shutdown();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await orchestrator.shutdown();
    process.exit(0);
  });

  await orchestrator.start();
}

// Run if invoked directly
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  main().catch((err) => {
    logger.fatal({ err }, "Fatal error in orchestrator");
    process.exit(1);
  });
}
