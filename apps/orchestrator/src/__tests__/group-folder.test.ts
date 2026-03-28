import { describe, expect, it } from "vitest";
import { isValidGroupFolder, resolveGroupFolderPath } from "../group-folder.js";

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

describe("resolveGroupFolderPath", () => {
  it("resolves valid folder to full path", () => {
    const result = resolveGroupFolderPath("/tmp/groups", "test");
    expect(result).toBe("/tmp/groups/test");
  });

  it("throws for invalid folder", () => {
    expect(() => resolveGroupFolderPath("/tmp/groups", "..")).toThrow();
  });
});
