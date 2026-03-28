import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import type { NagiDatabase } from "@nagi/db";
import { handleOverview } from "./routes/overview.js";
import { handleGroups } from "./routes/groups.js";
import { handleChannels } from "./routes/channels.js";
import { handleTasks, handleTaskLogs } from "./routes/tasks.js";
import { handleMessages } from "./routes/messages.js";

export function createApp(db: NagiDatabase, staticDir?: string) {
  const app = new Hono();

  app.use("/api/*", cors());

  // API routes
  app.get("/api/overview", (c) => c.json(handleOverview(db)));
  app.get("/api/groups", (c) => c.json(handleGroups(db)));
  app.get("/api/channels", (c) => c.json(handleChannels(db)));
  app.get("/api/tasks", (c) => c.json(handleTasks(db)));
  app.get("/api/tasks/:id/logs", (c) => c.json(handleTaskLogs(db, c.req.param("id"))));

  app.get("/api/messages", (c) => {
    const chatJid = c.req.query("chatJid") ?? null;
    const since = c.req.query("since") ?? null;
    const result = handleMessages(db, chatJid, since);
    if ("error" in result) {
      return c.json(result, 400);
    }
    return c.json(result);
  });

  // Static file serving for SPA
  if (staticDir) {
    app.use("/*", serveStatic({ root: staticDir }));
    // SPA fallback
    app.use("/*", serveStatic({ root: staticDir, path: "index.html" }));
  }

  return app;
}
