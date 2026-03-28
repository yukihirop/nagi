import type {
  GatewayEventFrame,
  GatewayFrame,
  GatewayRequestFrame,
  GatewayResponseFrame,
} from "./types.ts";

type PendingRequest = {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type GatewayEventHandler = (event: string, payload: unknown) => void;

export type GatewayStatusHandler = (connected: boolean) => void;

const REQUEST_TIMEOUT = 10_000;
const RECONNECT_BASE = 1_000;
const RECONNECT_MAX = 30_000;

let nextId = 1;

function generateId(): string {
  return `req-${nextId++}`;
}

export class GatewayClient {
  private url: string;
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private onEvent: GatewayEventHandler;
  private onStatus: GatewayStatusHandler;
  private reconnectDelay = RECONNECT_BASE;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(
    url: string,
    onEvent: GatewayEventHandler,
    onStatus: GatewayStatusHandler,
  ) {
    this.url = url;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
  }

  connect(): void {
    if (this.closed) return;
    this.cleanup();

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.reconnectDelay = RECONNECT_BASE;
      this.onStatus(true);
    });

    ws.addEventListener("message", (ev) => {
      this.handleMessage(ev.data as string);
    });

    ws.addEventListener("close", () => {
      this.onStatus(false);
      this.scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      // close event will follow
    });
  }

  async request<T = unknown>(method: string, payload?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }

    const id = generateId();
    const frame: GatewayRequestFrame = { type: "req", id, method, payload };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, REQUEST_TIMEOUT);

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanup();
  }

  private handleMessage(data: string): void {
    let frame: GatewayFrame;
    try {
      frame = JSON.parse(data) as GatewayFrame;
    } catch {
      return;
    }

    if (frame.type === "res") {
      this.handleResponse(frame as GatewayResponseFrame);
    } else if (frame.type === "event") {
      this.onEvent(
        (frame as GatewayEventFrame).event,
        (frame as GatewayEventFrame).payload,
      );
    }
  }

  private handleResponse(frame: GatewayResponseFrame): void {
    const pending = this.pending.get(frame.id);
    if (!pending) return;
    this.pending.delete(frame.id);
    clearTimeout(pending.timer);

    if (frame.ok) {
      pending.resolve(frame.payload);
    } else {
      pending.reject(
        new Error(frame.error?.message ?? "Unknown gateway error"),
      );
    }
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Connection closed"));
    }
    this.pending.clear();
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      RECONNECT_MAX,
    );
  }
}
