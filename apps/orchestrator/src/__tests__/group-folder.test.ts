import { describe, expect, it } from "vitest";
import { isValidGroupFolder, isValidChannel, resolveGroupFolderPath } from "../group-folder.js";

describe("isValidGroupFolder", () => {
  it("accepts valid folder names", () => {
    expect(isValidGroupFolder("main")).toBe(true);
    expect(isValidGroupFolder("discord_general")).toBe(true);
    expect(isValidGroupFolder("slack-dev-team")).toBe(true);
    expect(isValidGroupFolder("test123")).toBe(true);
  });

  it("rejects invalid folder names", () => {
    expect(isValidGroupFolder("")).toBe(false);
    expect(isValidGroupFolder("..")).toBe(false);
    expect(isValidGroupFolder("../etc")).toBe(false);
    expect(isValidGroupFolder("foo/bar")).toBe(false);
    expect(isValidGroupFolder(" spaces ")).toBe(false);
    expect(isValidGroupFolder("global")).toBe(false);
  });

  it("rejects path traversal attempts", () => {
    expect(isValidGroupFolder("..%2f..")).toBe(false);
    expect(isValidGroupFolder("foo\\bar")).toBe(false);
  });
});

describe("isValidChannel", () => {
  it("accepts valid channel names", () => {
    expect(isValidChannel("slack")).toBe(true);
    expect(isValidChannel("discord")).toBe(true);
    expect(isValidChannel("whatsapp")).toBe(true);
    expect(isValidChannel("telegram")).toBe(true);
  });

  it("rejects invalid channel names", () => {
    expect(isValidChannel("")).toBe(false);
    expect(isValidChannel("..")).toBe(false);
    expect(isValidChannel("foo/bar")).toBe(false);
    expect(isValidChannel(" spaces ")).toBe(false);
    expect(isValidChannel("Uppercase")).toBe(false);
  });
});

describe("resolveGroupFolderPath", () => {
  it("resolves valid channel and folder to full path", () => {
    const result = resolveGroupFolderPath("/tmp/groups", "slack", "test");
    expect(result).toBe("/tmp/groups/slack/test");
  });

  it("throws for invalid folder", () => {
    expect(() => resolveGroupFolderPath("/tmp/groups", "slack", "..")).toThrow();
  });

  it("throws for invalid channel", () => {
    expect(() => resolveGroupFolderPath("/tmp/groups", "..", "test")).toThrow();
  });
});
