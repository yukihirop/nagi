import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { createDatabase } from "@nagi/db";
import { createLogger } from "@nagi/logger";
import { createApp } from "./server.js";
import { setupWebSocket } from "./ws.js";
import { IpcFileWatcher } from "./watcher.js";

const logger = createLogger({ name: "ui-server" });

// Resolve project root by walking up from this file to find pnpm-workspace.yaml
function findProjectRoot(): string {
  let dir = import.meta.dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function parseArgs(args: string[]) {
  let port = 3001;
  const assistantName = process.env.ASSISTANT_NAME || "Andy";
  let dataDir = path.join(findProjectRoot(), "__data", assistantName);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--data-dir" && args[i + 1]) {
      dataDir = path.resolve(args[i + 1]);
      i++;
    }
  }

  return { port, dataDir };
}

const { port, dataDir } = parseArgs(process.argv.slice(2));
const dbPath = path.join(dataDir, "store", "messages.db");

// Ensure DB directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

logger.info({ dbPath, dataDir, port }, "Starting UI server");

const db = createDatabase({ path: dbPath });

// Static dir: tools/ui/dist relative to this package
const staticDir = path.resolve(import.meta.dirname, "../../ui/dist");

const app = createApp({ db, dataDir, staticDir });
const { injectWebSocket, broadcast } = setupWebSocket(app, db);

const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port }, "UI server listening");
});

injectWebSocket(server);

// Watch IPC directory for changes
const watcher = new IpcFileWatcher({
  dataDir,
  onChanged: (event) => broadcast(event),
});
watcher.start();

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down...");
  watcher.stop();
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  watcher.stop();
  db.close();
  process.exit(0);
});
