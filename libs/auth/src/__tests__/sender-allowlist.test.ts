import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadSenderAllowlist,
  isSenderAllowed,
  shouldDropMessage,
  isTriggerAllowed,
  type SenderAllowlistConfig,
} from "../index.js";

const tmpDir = os.tmpdir();

function writeJson(filename: string, data: unknown): string {
  const filePath = path.join(tmpDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data));
  return filePath;
}

describe("loadSenderAllowlist", () => {
  it("returns default config for missing file", () => {
    const cfg = loadSenderAllowlist("/nonexistent/path.json");
    expect(cfg.default.allow).toBe("*");
    expect(cfg.default.mode).toBe("trigger");
    expect(cfg.chats).toEqual({});
    expect(cfg.logDenied).toBe(true);
  });

  it("loads valid config from file", () => {
    const filePath = writeJson("test-allowlist-valid.json", {
      default: { allow: "*", mode: "trigger" },
      chats: {
        "dc:123": { allow: ["user1", "user2"], mode: "drop" },
      },
      logDenied: false,
    });
    const cfg = loadSenderAllowlist(filePath);
    expect(cfg.default.allow).toBe("*");
    expect(cfg.chats["dc:123"].allow).toEqual(["user1", "user2"]);
    expect(cfg.chats["dc:123"].mode).toBe("drop");
    expect(cfg.logDenied).toBe(false);
    fs.unlinkSync(filePath);
  });

  it("returns default config for invalid JSON", () => {
    const filePath = path.join(tmpDir, "test-allowlist-bad.json");
    fs.writeFileSync(filePath, "not json{");
    const cfg = loadSenderAllowlist(filePath);
    expect(cfg.default.allow).toBe("*");
    fs.unlinkSync(filePath);
  });

  it("returns default config for invalid default entry", () => {
    const filePath = writeJson("test-allowlist-nodefault.json", {
      default: { allow: 123, mode: "bad" },
    });
    const cfg = loadSenderAllowlist(filePath);
    expect(cfg.default.allow).toBe("*");
    fs.unlinkSync(filePath);
  });

  it("skips invalid chat entries", () => {
    const filePath = writeJson("test-allowlist-badchat.json", {
      default: { allow: "*", mode: "trigger" },
      chats: {
        "dc:good": { allow: ["user1"], mode: "trigger" },
        "dc:bad": { allow: 123, mode: "invalid" },
      },
    });
    const cfg = loadSenderAllowlist(filePath);
    expect(cfg.chats["dc:good"]).toBeDefined();
    expect(cfg.chats["dc:bad"]).toBeUndefined();
    fs.unlinkSync(filePath);
  });
});

describe("isSenderAllowed", () => {
  const cfg: SenderAllowlistConfig = {
    default: { allow: "*", mode: "trigger" },
    chats: {
      "dc:restricted": { allow: ["alice", "bob"], mode: "trigger" },
    },
    logDenied: false,
  };

  it("allows all senders with wildcard", () => {
    expect(isSenderAllowed("dc:open", "anyone", cfg)).toBe(true);
  });

  it("allows listed senders", () => {
    expect(isSenderAllowed("dc:restricted", "alice", cfg)).toBe(true);
    expect(isSenderAllowed("dc:restricted", "bob", cfg)).toBe(true);
  });

  it("denies unlisted senders", () => {
    expect(isSenderAllowed("dc:restricted", "charlie", cfg)).toBe(false);
  });
});

describe("shouldDropMessage", () => {
  const cfg: SenderAllowlistConfig = {
    default: { allow: "*", mode: "trigger" },
    chats: {
      "dc:drop": { allow: "*", mode: "drop" },
    },
    logDenied: false,
  };

  it("returns false for trigger mode", () => {
    expect(shouldDropMessage("dc:open", cfg)).toBe(false);
  });

  it("returns true for drop mode", () => {
    expect(shouldDropMessage("dc:drop", cfg)).toBe(true);
  });
});

describe("isTriggerAllowed", () => {
  const cfg: SenderAllowlistConfig = {
    default: { allow: ["admin"], mode: "trigger" },
    chats: {},
    logDenied: false,
  };

  it("returns true for allowed sender", () => {
    expect(isTriggerAllowed("dc:123", "admin", cfg)).toBe(true);
  });

  it("returns false for denied sender", () => {
    expect(isTriggerAllowed("dc:123", "stranger", cfg)).toBe(false);
  });
});
