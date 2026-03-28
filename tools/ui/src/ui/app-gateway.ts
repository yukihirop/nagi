import { GatewayClient } from "./gateway.ts";
import type { NagiApp } from "./app.ts";

let client: GatewayClient | null = null;

function deriveWsUrl(): string {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/api/ws`;
}

export function connectGateway(app: NagiApp): void {
  if (client) return;

  const url = deriveWsUrl();
  client = new GatewayClient(
    url,
    (event, payload) => handleEvent(app, event, payload),
    (connected) => {
      app.connected = connected;
      if (connected) {
        loadInitialState(app);
      }
    },
  );
  client.connect();
}

export function disconnectGateway(): void {
  if (client) {
    client.close();
    client = null;
  }
}

async function loadInitialState(app: NagiApp): Promise<void> {
  if (!client) return;
  try {
    const state = await client.request<{
      groups: number;
      channels: number;
      queueDepth: number;
      tasks: number;
    }>("state.overview");
    app.groupCount = state.groups;
    app.channelCount = state.channels;
    app.queueDepth = state.queueDepth;
    app.taskCount = state.tasks;
  } catch {
    // orchestrator not yet available — will retry on reconnect
  }
}

function handleEvent(
  app: NagiApp,
  event: string,
  _payload: unknown,
): void {
  switch (event) {
    case "state.updated":
      loadInitialState(app);
      break;
  }
}
