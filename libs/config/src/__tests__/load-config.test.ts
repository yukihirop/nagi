import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { loadConfig } from "../index.js";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubEnv("ASSISTANT_NAME", "");
    vi.stubEnv("ASSISTANT_HAS_OWN_NUMBER", "");
    vi.stubEnv("CONTAINER_IMAGE", "");
    vi.stubEnv("CONTAINER_TIMEOUT", "");
    vi.stubEnv("CONTAINER_MAX_OUTPUT_SIZE", "");
    vi.stubEnv("IDLE_TIMEOUT", "");
    vi.stubEnv("MAX_CONCURRENT_CONTAINERS", "");
    vi.stubEnv("CREDENTIAL_PROXY_PORT", "");
    vi.stubEnv("TZ", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads with all defaults", () => {
    const config = loadConfig({ projectRoot: "/tmp/test" });
    expect(config.assistantName).toBe("Andy");
    expect(config.assistantHasOwnNumber).toBe(false);
    expect(config.container.image).toBe("nagi-agent:latest");
    expect(config.container.timeout).toBe(1800000);
    expect(config.container.maxOutputSize).toBe(10485760);
    expect(config.container.maxConcurrent).toBe(5);
    expect(config.container.credentialProxyPort).toBe(3002);
    expect(config.intervals.poll).toBe(2000);
    expect(config.intervals.schedulerPoll).toBe(60000);
    expect(config.intervals.ipcPoll).toBe(1000);
  });

  it("generates paths from projectRoot", () => {
    const config = loadConfig({ projectRoot: "/my/project" });
    expect(config.paths.deployDir).toBe("/my/project/deploy/Andy");
    expect(config.paths.dataDir).toBe("/my/project/__data/Andy");
    expect(config.paths.groupsDir).toBe("/my/project/__data/Andy/groups");
  });

  it("generates triggerPattern from assistantName", () => {
    const config = loadConfig({ assistantName: "Nagi" });
    expect(config.triggerPattern.test("@Nagi hello")).toBe(true);
    expect(config.triggerPattern.test("@nagi hello")).toBe(true);
    expect(config.triggerPattern.test("hello @Nagi")).toBe(false);
  });

  it("applies overrides", () => {
    const config = loadConfig({
      projectRoot: "/tmp",
      assistantName: "Bot",
      container: { timeout: 5000, maxConcurrent: 10 },
    });
    expect(config.assistantName).toBe("Bot");
    expect(config.container.timeout).toBe(5000);
    expect(config.container.maxConcurrent).toBe(10);
    // Other container defaults preserved
    expect(config.container.image).toBe("nagi-agent:latest");
  });

  it("reads from environment variables", () => {
    vi.stubEnv("ASSISTANT_NAME", "EnvBot");
    vi.stubEnv("CONTAINER_TIMEOUT", "60000");
    vi.stubEnv("MAX_CONCURRENT_CONTAINERS", "3");

    const config = loadConfig({ projectRoot: "/tmp" });
    expect(config.assistantName).toBe("EnvBot");
    expect(config.container.timeout).toBe(60000);
    expect(config.container.maxConcurrent).toBe(3);
  });

  it("overrides take precedence over env", () => {
    vi.stubEnv("ASSISTANT_NAME", "EnvBot");
    const config = loadConfig({
      projectRoot: "/tmp",
      assistantName: "Override",
    });
    expect(config.assistantName).toBe("Override");
  });

  it("has mountAllowlistPath and senderAllowlistPath", () => {
    const config = loadConfig({ projectRoot: "/tmp" });
    expect(config.paths.mountAllowlistPath).toContain("mount-allowlist.json");
    expect(config.paths.senderAllowlistPath).toContain(
      "sender-allowlist.json",
    );
  });
});
