import { describe, expect, it, vi } from "vitest";
import { DiscordChannel, createDiscordFactory } from "../index.js";
import type { ChannelOpts } from "@nagi/channel-core";

const mockOpts: ChannelOpts = {
  onMessage: vi.fn(),
  onChatMetadata: vi.fn(),
  registeredGroups: () => ({}),
};

const baseConfig = {
  botToken: "test-token",
};

describe("DiscordChannel", () => {
  it("has name 'discord'", () => {
    const channel = new DiscordChannel(baseConfig, mockOpts);
    expect(channel.name).toBe("discord");
  });

  it("ownsJid returns true for discord: prefix", () => {
    const channel = new DiscordChannel(baseConfig, mockOpts);
    expect(channel.ownsJid("discord:123456")).toBe(true);
    expect(channel.ownsJid("discord:")).toBe(true);
  });

  it("ownsJid returns false for non-discord: prefix", () => {
    const channel = new DiscordChannel(baseConfig, mockOpts);
    expect(channel.ownsJid("slack:123456")).toBe(false);
    expect(channel.ownsJid("123456")).toBe(false);
    expect(channel.ownsJid("")).toBe(false);
  });

  it("isConnected returns false before connect", () => {
    const channel = new DiscordChannel(baseConfig, mockOpts);
    expect(channel.isConnected()).toBe(false);
  });

  it("accepts custom assistantName", () => {
    const channel = new DiscordChannel(
      { ...baseConfig, assistantName: "Nagi" },
      mockOpts,
    );
    expect(channel.name).toBe("discord");
  });

  it("accepts custom triggerPattern", () => {
    const channel = new DiscordChannel(
      { ...baseConfig, triggerPattern: /^!nagi\b/i },
      mockOpts,
    );
    expect(channel.name).toBe("discord");
  });
});

describe("createDiscordFactory", () => {
  it("returns a factory function", () => {
    const factory = createDiscordFactory(baseConfig);
    expect(typeof factory).toBe("function");
  });

  it("factory creates a DiscordChannel instance", () => {
    const factory = createDiscordFactory(baseConfig);
    const channel = factory(mockOpts);
    expect(channel).not.toBeNull();
    expect(channel!.name).toBe("discord");
    expect(channel!.ownsJid("discord:123")).toBe(true);
  });
});
