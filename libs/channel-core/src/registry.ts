import type { RegisteredGroup } from "@nagi/types";
import type { Channel, OnInboundMessage, OnChatMetadata } from "./channel.js";

export interface ChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

export type ChannelFactory = (opts: ChannelOpts) => Channel | null;

export class ChannelRegistry {
  private factories = new Map<string, ChannelFactory>();

  register(name: string, factory: ChannelFactory): void {
    this.factories.set(name, factory);
  }

  get(name: string): ChannelFactory | undefined {
    return this.factories.get(name);
  }

  getAll(): string[] {
    return [...this.factories.keys()];
  }
}
