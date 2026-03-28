import { describe, expect, it } from "vitest";
import { ChannelRegistry } from "../index.js";
import type { ChannelFactory, Channel, ChannelOpts } from "../index.js";

function createMockFactory(name: string): ChannelFactory {
  return (opts: ChannelOpts): Channel => ({
    name,
    connect: async () => {},
    sendMessage: async () => {},
    isConnected: () => true,
    ownsJid: (jid: string) => jid.startsWith(`${name}:`),
    disconnect: async () => {},
  });
}

describe("ChannelRegistry", () => {
  it("registers and retrieves a factory", () => {
    const registry = new ChannelRegistry();
    const factory = createMockFactory("discord");
    registry.register("discord", factory);

    expect(registry.get("discord")).toBe(factory);
  });

  it("returns undefined for unregistered channel", () => {
    const registry = new ChannelRegistry();

    expect(registry.get("telegram")).toBeUndefined();
  });

  it("returns all registered channel names", () => {
    const registry = new ChannelRegistry();
    registry.register("discord", createMockFactory("discord"));
    registry.register("slack", createMockFactory("slack"));

    expect(registry.getAll()).toEqual(["discord", "slack"]);
  });

  it("overwrites factory on duplicate registration", () => {
    const registry = new ChannelRegistry();
    const factory1 = createMockFactory("discord");
    const factory2 = createMockFactory("discord");
    registry.register("discord", factory1);
    registry.register("discord", factory2);

    expect(registry.get("discord")).toBe(factory2);
    expect(registry.getAll()).toEqual(["discord"]);
  });

  it("factory can return null for unconfigured channels", () => {
    const registry = new ChannelRegistry();
    const nullFactory: ChannelFactory = () => null;
    registry.register("telegram", nullFactory);

    const factory = registry.get("telegram")!;
    const channel = factory({
      onMessage: () => {},
      onChatMetadata: () => {},
      registeredGroups: () => ({}),
    });

    expect(channel).toBeNull();
  });

  it("starts with empty registry", () => {
    const registry = new ChannelRegistry();

    expect(registry.getAll()).toEqual([]);
  });
});
