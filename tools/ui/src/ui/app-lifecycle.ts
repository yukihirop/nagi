import { connectGateway, disconnectGateway } from "./app-gateway.ts";
import { applySettings, onPopState } from "./app-settings.ts";
import type { NagiApp } from "./app.ts";

const popStateHandlers = new WeakMap<NagiApp, () => void>();

export function handleConnected(app: NagiApp): void {
  applySettings(app);
  connectGateway(app);
  const handler = () => onPopState(app);
  popStateHandlers.set(app, handler);
  window.addEventListener("popstate", handler);
}

export function handleDisconnected(app: NagiApp): void {
  disconnectGateway();
  const handler = popStateHandlers.get(app);
  if (handler) {
    window.removeEventListener("popstate", handler);
    popStateHandlers.delete(app);
  }
}
