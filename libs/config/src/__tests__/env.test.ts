import { describe, expect, it } from "vitest";
import { readEnvFile } from "../index.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("readEnvFile", () => {
  const tmpDir = os.tmpdir();

  it("reads requested keys from .env file", () => {
    const envPath = path.join(tmpDir, ".env.test-read");
    fs.writeFileSync(envPath, "FOO=bar\nBAZ=qux\nIGNORED=yes\n");

    const result = readEnvFile(["FOO", "BAZ"], envPath);
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });

    fs.unlinkSync(envPath);
  });

  it("strips surrounding quotes", () => {
    const envPath = path.join(tmpDir, ".env.test-quotes");
    fs.writeFileSync(envPath, 'A="double"\nB=\'single\'\n');

    const result = readEnvFile(["A", "B"], envPath);
    expect(result).toEqual({ A: "double", B: "single" });

    fs.unlinkSync(envPath);
  });

  it("skips comments and empty lines", () => {
    const envPath = path.join(tmpDir, ".env.test-comments");
    fs.writeFileSync(envPath, "# comment\n\nKEY=value\n");

    const result = readEnvFile(["KEY"], envPath);
    expect(result).toEqual({ KEY: "value" });

    fs.unlinkSync(envPath);
  });

  it("returns empty object for missing file", () => {
    const result = readEnvFile(["KEY"], "/nonexistent/.env");
    expect(result).toEqual({});
  });

  it("returns empty object for unrequested keys", () => {
    const envPath = path.join(tmpDir, ".env.test-unrequested");
    fs.writeFileSync(envPath, "FOO=bar\n");

    const result = readEnvFile(["OTHER"], envPath);
    expect(result).toEqual({});

    fs.unlinkSync(envPath);
  });
});
