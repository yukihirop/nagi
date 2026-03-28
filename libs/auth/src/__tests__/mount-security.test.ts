import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateMount, validateAdditionalMounts } from "../index.js";
import type { MountAllowlist } from "@nagi/types";

const tmpDir = path.join(os.tmpdir(), "nagi-mount-test-" + Date.now());

// Create test directories
fs.mkdirSync(path.join(tmpDir, "projects", "my-app"), { recursive: true });
fs.mkdirSync(path.join(tmpDir, "secrets", ".ssh"), { recursive: true });

const allowlist: MountAllowlist = {
  allowedRoots: [
    { path: path.join(tmpDir, "projects"), allowReadWrite: true },
  ],
  blockedPatterns: [],
  nonMainReadOnly: true,
};

describe("validateMount", () => {
  it("allows mount under allowed root", () => {
    const result = validateMount(
      { hostPath: path.join(tmpDir, "projects", "my-app") },
      allowlist,
      true,
    );
    expect(result.allowed).toBe(true);
    expect(result.realHostPath).toContain("my-app");
  });

  it("rejects mount outside allowed roots", () => {
    const result = validateMount(
      { hostPath: path.join(tmpDir, "secrets") },
      allowlist,
      true,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not under any allowed root");
  });

  it("rejects mount matching blocked pattern", () => {
    const result = validateMount(
      { hostPath: path.join(tmpDir, "secrets", ".ssh") },
      { ...allowlist, allowedRoots: [{ path: tmpDir, allowReadWrite: true }] },
      true,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain(".ssh");
  });

  it("rejects nonexistent path", () => {
    const result = validateMount(
      { hostPath: "/nonexistent/path/12345" },
      allowlist,
      true,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("does not exist");
  });

  it("rejects invalid container path with ..", () => {
    const result = validateMount(
      { hostPath: path.join(tmpDir, "projects"), containerPath: "../escape" },
      allowlist,
      true,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Invalid container path");
  });

  it("forces read-only for non-main when nonMainReadOnly", () => {
    const result = validateMount(
      { hostPath: path.join(tmpDir, "projects", "my-app"), readonly: false },
      allowlist,
      false, // non-main
    );
    expect(result.allowed).toBe(true);
    expect(result.effectiveReadonly).toBe(true);
  });

  it("allows read-write for main group", () => {
    const result = validateMount(
      { hostPath: path.join(tmpDir, "projects", "my-app"), readonly: false },
      allowlist,
      true, // main
    );
    expect(result.allowed).toBe(true);
    expect(result.effectiveReadonly).toBe(false);
  });

  it("forces read-only when root disallows read-write", () => {
    const roAllowlist: MountAllowlist = {
      ...allowlist,
      allowedRoots: [
        { path: path.join(tmpDir, "projects"), allowReadWrite: false },
      ],
    };
    const result = validateMount(
      { hostPath: path.join(tmpDir, "projects", "my-app"), readonly: false },
      roAllowlist,
      true,
    );
    expect(result.allowed).toBe(true);
    expect(result.effectiveReadonly).toBe(true);
  });
});

describe("validateAdditionalMounts", () => {
  it("returns validated mounts with /workspace/extra/ prefix", () => {
    const result = validateAdditionalMounts(
      [{ hostPath: path.join(tmpDir, "projects", "my-app") }],
      allowlist,
      "test-group",
      true,
    );
    expect(result).toHaveLength(1);
    expect(result[0].containerPath).toContain("/workspace/extra/");
  });

  it("filters out rejected mounts", () => {
    const result = validateAdditionalMounts(
      [
        { hostPath: path.join(tmpDir, "projects", "my-app") },
        { hostPath: "/nonexistent/blocked" },
      ],
      allowlist,
      "test-group",
      true,
    );
    expect(result).toHaveLength(1);
  });

  it("returns empty for all rejected", () => {
    const result = validateAdditionalMounts(
      [{ hostPath: "/nonexistent" }],
      allowlist,
      "test-group",
      true,
    );
    expect(result).toHaveLength(0);
  });
});
