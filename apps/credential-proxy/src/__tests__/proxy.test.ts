import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Server } from "node:http";
import { startCredentialProxy, detectAuthMode } from "../index.js";

const tmpDir = os.tmpdir();

function writeEnvFile(
  filename: string,
  vars: Record<string, string>,
): string {
  const filePath = path.join(tmpDir, filename);
  const content = Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe("detectAuthMode", () => {
  it("returns api-key when ANTHROPIC_API_KEY is set", () => {
    const envPath = writeEnvFile("detect-apikey.env", {
      ANTHROPIC_API_KEY: "sk-test-123",
    });
    expect(detectAuthMode(envPath)).toBe("api-key");
    fs.unlinkSync(envPath);
  });

  it("returns oauth when ANTHROPIC_API_KEY is not set", () => {
    const envPath = writeEnvFile("detect-oauth.env", {
      CLAUDE_CODE_OAUTH_TOKEN: "oauth-token",
    });
    expect(detectAuthMode(envPath)).toBe("oauth");
    fs.unlinkSync(envPath);
  });

  it("returns oauth for empty env file", () => {
    const envPath = writeEnvFile("detect-empty.env", {});
    expect(detectAuthMode(envPath)).toBe("oauth");
    fs.unlinkSync(envPath);
  });
});

describe("startCredentialProxy", () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  it("starts and listens on specified port", async () => {
    const envPath = writeEnvFile("proxy-start.env", {
      ANTHROPIC_API_KEY: "sk-test-123",
    });

    server = await startCredentialProxy({
      port: 0, // OS assigns random port
      envPath,
    });

    const addr = server.address();
    expect(addr).toBeTruthy();
    expect(typeof addr === "object" && addr !== null && addr.port > 0).toBe(
      true,
    );

    fs.unlinkSync(envPath);
  });
});
