import { describe, expect, it, vi } from "vitest";
import { routeOutbound, findChannel } from "../index.js";
import type { Channel } from "@nagi/channel-core";

function createMockChannel(
  name: string,
  prefix: string,
  connected = true,
): Channel {
  return {
    name,
    connect: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    isConnected: () => connected,
    ownsJid: (jid: string) => jid.startsWith(prefix),
    disconnect: vi.fn(),
  };
}

describe("findChannel", () => {
  it("finds channel by JID prefix", () => {
    const discord = createMockChannel("discord", "discord:");
    const slack = createMockChannel("slack", "slack:");
    expect(findChannel([discord, slack], "discord:123")).toBe(discord);
    expect(findChannel([discord, slack], "slack:456")).toBe(slack);
  });

  it("returns undefined for unknown JID", () => {
    const discord = createMockChannel("discord", "discord:");
    expect(findChannel([discord], "tg:789")).toBeUndefined();
  });
});

describe("routeOutbound", () => {
  it("sends message to correct channel", async () => {
    const discord = createMockChannel("discord", "discord:");
    await routeOutbound([discord], "discord:123", "hello");
    expect(discord.sendMessage).toHaveBeenCalledWith("discord:123", "hello");
  });

  it("throws for unknown JID", () => {
    const discord = createMockChannel("discord", "discord:");
    expect(() => routeOutbound([discord], "tg:123", "hello")).toThrow(
      "No channel for JID: tg:123",
    );
  });

  it("skips disconnected channels", () => {
    const discord = createMockChannel("discord", "discord:", false);
    expect(() => routeOutbound([discord], "discord:123", "hello")).toThrow(
      "No channel for JID: discord:123",
    );
  });
});
