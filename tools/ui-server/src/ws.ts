import type { Hono } from "hono";
import { createNodeWebSocket } from "@hono/node-ws";
import type { NagiDatabase } from "@nagi/db";
import { createLogger } from "@nagi/logger";
import { handleOverview } from "./routes/overview.js";
import { handleGroups } from "./routes/groups.js";
import { handleChannels } from "./routes/channels.js";
import { handleTasks } from "./routes/tasks.js";

const logger = createLogger({ name: "ui-ws" });

type WsRequestFrame = {
  type: "req";
  id: string;
  method: string;
  payload?: unknown;
};

type WsResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string };
};

type WsEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
};

function handleRequest(db: NagiDatabase, method: string): unknown {
  switch (method) {
    case "state.overview":
      return handleOverview(db);
    case "groups.list":
      return handleGroups(db);
    case "channels.list":
      return handleChannels(db);
    case "tasks.list":
      return handleTasks(db);
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

export function setupWebSocket(app: Hono, db: NagiDatabase) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  const clients = new Set<{ send: (data: string) => void }>();

  app.get(
    "/api/ws",
    upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        logger.debug("WS client connected");
        clients.add(ws);
      },

      onMessage(event, ws) {
        let frame: WsRequestFrame;
        try {
          frame = JSON.parse(event.data as string) as WsRequestFrame;
        } catch {
          return;
        }

        if (frame.type !== "req" || !frame.id || !frame.method) {
          return;
        }

        try {
          const payload = handleRequest(db, frame.method);
          const res: WsResponseFrame = { type: "res", id: frame.id, ok: true, payload };
          ws.send(JSON.stringify(res));
        } catch (err) {
          const res: WsResponseFrame = {
            type: "res",
            id: frame.id,
            ok: false,
            error: {
              code: "INTERNAL",
              message: err instanceof Error ? err.message : "Unknown error",
            },
          };
          ws.send(JSON.stringify(res));
        }
      },

      onClose(_event, ws) {
        logger.debug("WS client disconnected");
        clients.delete(ws);
      },
    })),
  );

  function broadcast(event: string, payload?: unknown): void {
    const frame: WsEventFrame = { type: "event", event, payload };
    const msg = JSON.stringify(frame);
    for (const client of clients) {
      client.send(msg);
    }
  }

  return { injectWebSocket, broadcast };
}
