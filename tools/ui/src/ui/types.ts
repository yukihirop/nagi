export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string };
};

export type GatewayRequestFrame = {
  type: "req";
  id: string;
  method: string;
  payload?: unknown;
};

export type GatewayFrame =
  | GatewayEventFrame
  | GatewayResponseFrame
  | GatewayRequestFrame;

export type GroupInfo = {
  id: string;
  name: string;
  status: "idle" | "busy";
};

export type ChannelInfo = {
  id: string;
  type: string;
  connected: boolean;
};

export type TaskInfo = {
  id: string;
  name: string;
  schedule: string;
  lastRun?: string;
  nextRun?: string;
};

export type OverviewState = {
  groups: number;
  channels: number;
  queueDepth: number;
  tasks: number;
  uptime: number;
};
