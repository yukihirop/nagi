import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import type { NagiDatabase } from "@nagi/db";
import { handleOverview } from "./routes/overview.js";
import { handleGroups } from "./routes/groups.js";
import { handleChannels } from "./routes/channels.js";
import { handleTasks, handleTaskLogs } from "./routes/tasks.js";
import { handleMessages } from "./routes/messages.js";
import { handleSessions, handleSessionMessages, handleSessionThreads, handleSessionThreadMessages } from "./routes/sessions.js";
import { handleLogs } from "./routes/logs.js";

export interface AppOptions {
  db: NagiDatabase;
  dataDir: string;
  staticDir?: string;
}

export function createApp(opts: AppOptions) {
  const { db, dataDir, staticDir } = opts;
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

  app.get("/api/logs", (c) => c.json(handleLogs(dataDir, db, c.req.query("filter") ?? undefined)));

  app.get("/api/sessions", (c) => c.json(handleSessions(dataDir)));
  app.get("/api/sessions/:id/messages", async (c) => {
    const messages = await handleSessionMessages(dataDir, c.req.param("id"));
    return c.json(messages);
  });
  app.get("/api/sessions/:id/threads", async (c) => {
    const threads = await handleSessionThreads(dataDir, c.req.param("id"));
    return c.json(threads);
  });
  app.get("/api/sessions/:id/threads/:index/messages", async (c) => {
    const messages = await handleSessionThreadMessages(
      dataDir,
      c.req.param("id"),
      parseInt(c.req.param("index"), 10),
    );
    return c.json(messages);
  });

  // Static file serving for SPA
  if (staticDir) {
    app.use("/*", serveStatic({ root: staticDir }));
    // SPA fallback
    app.use("/*", serveStatic({ root: staticDir, path: "index.html" }));
  }

  return app;
}
