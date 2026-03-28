import { describe, expect, it, vi } from "vitest";
import { SlackChannel, createSlackFactory } from "../index.js";
import type { ChannelOpts } from "@nagi/channel-core";

// Mock @slack/bolt to avoid real connections in tests
vi.mock("@slack/bolt", () => ({
  App: vi.fn().mockImplementation(() => ({
    event: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    client: {
      auth: { test: vi.fn().mockResolvedValue({ user_id: "U_BOT" }) },
      chat: { postMessage: vi.fn().mockResolvedValue({}) },
      conversations: { list: vi.fn().mockResolvedValue({ channels: [] }) },
      users: { info: vi.fn().mockResolvedValue({ user: { real_name: "Test" } }) },
    },
  })),
  LogLevel: { ERROR: "error" },
}));

const mockOpts: ChannelOpts = {
  onMessage: vi.fn(),
  onChatMetadata: vi.fn(),
  registeredGroups: () => ({}),
};

const baseConfig = {
  botToken: "xoxb-test",
  appToken: "xapp-test",
};

describe("SlackChannel", () => {
  it("has name 'slack'", () => {
    const channel = new SlackChannel(baseConfig, mockOpts);
    expect(channel.name).toBe("slack");
  });

  it("ownsJid returns true for slack: prefix", () => {
    const channel = new SlackChannel(baseConfig, mockOpts);
    expect(channel.ownsJid("slack:C123")).toBe(true);
    expect(channel.ownsJid("slack:")).toBe(true);
  });

  it("ownsJid returns false for non-slack: prefix", () => {
    const channel = new SlackChannel(baseConfig, mockOpts);
    expect(channel.ownsJid("dc:123")).toBe(false);
    expect(channel.ownsJid("123")).toBe(false);
  });

  it("isConnected returns false before connect", () => {
    const channel = new SlackChannel(baseConfig, mockOpts);
    expect(channel.isConnected()).toBe(false);
  });

  it("connects and sets connected state", async () => {
    const channel = new SlackChannel(baseConfig, mockOpts);
    await channel.connect();
    expect(channel.isConnected()).toBe(true);
  });

  it("disconnects and clears connected state", async () => {
    const channel = new SlackChannel(baseConfig, mockOpts);
    await channel.connect();
    await channel.disconnect();
    expect(channel.isConnected()).toBe(false);
  });

  it("accepts custom assistantName", () => {
    const channel = new SlackChannel(
      { ...baseConfig, assistantName: "Nagi" },
      mockOpts,
    );
    expect(channel.name).toBe("slack");
  });

  it("setTyping is a no-op", async () => {
    const channel = new SlackChannel(baseConfig, mockOpts);
    // Should not throw
    await channel.setTyping("slack:C123", true);
    await channel.setTyping("slack:C123", false);
  });
});

describe("createSlackFactory", () => {
  it("returns a factory function", () => {
    const factory = createSlackFactory(baseConfig);
    expect(typeof factory).toBe("function");
  });

  it("factory creates a SlackChannel instance", () => {
    const factory = createSlackFactory(baseConfig);
    const channel = factory(mockOpts);
    expect(channel).not.toBeNull();
    expect(channel!.name).toBe("slack");
    expect(channel!.ownsJid("slack:C123")).toBe(true);
  });
});
