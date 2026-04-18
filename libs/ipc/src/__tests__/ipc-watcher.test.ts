import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { IpcWatcher, type IpcDeps, type IpcTaskRepo } from "../index.js";

const tmpDir = path.join(os.tmpdir(), "nagi-ipc-test-" + Date.now());

function createMockDeps(): IpcDeps {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    registeredGroups: vi.fn().mockReturnValue({
      "discord:123": {
        name: "Main",
        channel: "discord",
        folder: "main",
        trigger: "!test",
        added_at: "2026-01-01T00:00:00Z",
        isMain: true,
      },
    }),
    registerGroup: vi.fn(),
    syncGroups: vi.fn().mockResolvedValue(undefined),
    getAvailableGroups: vi.fn().mockReturnValue([]),
    writeGroupsSnapshot: vi.fn(),
    onTasksChanged: vi.fn(),
  };
}

function createMockTaskRepo(): IpcTaskRepo {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

describe("IpcWatcher", () => {
  let watcher: IpcWatcher;

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    watcher?.stop();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("starts and stops without error", () => {
    watcher = new IpcWatcher({
      dataDir: tmpDir,
      pollInterval: 100000,
      timezone: "UTC",
      taskRepo: createMockTaskRepo(),
      deps: createMockDeps(),
    });

    watcher.start();
    watcher.stop();
  });

  it("does not start twice", () => {
    watcher = new IpcWatcher({
      dataDir: tmpDir,
      pollInterval: 100000,
      timezone: "UTC",
      taskRepo: createMockTaskRepo(),
      deps: createMockDeps(),
    });

    watcher.start();
    watcher.start(); // should be a no-op
    watcher.stop();
  });

  it("processes message files", async () => {
    const deps = createMockDeps();
    watcher = new IpcWatcher({
      dataDir: tmpDir,
      pollInterval: 100000,
      timezone: "UTC",
      taskRepo: createMockTaskRepo(),
      deps,
    });

    // Write a message file to the 2-level directory structure: ipc/{channel}/{folder}/messages
    const msgDir = path.join(tmpDir, "ipc", "discord", "main", "messages");
    fs.mkdirSync(msgDir, { recursive: true });
    fs.writeFileSync(
      path.join(msgDir, "test.json"),
      JSON.stringify({ type: "message", chatJid: "discord:123", text: "hello" }),
    );

    watcher.start();

    await vi.waitFor(() => {
      expect(deps.sendMessage).toHaveBeenCalledWith("discord:123", "hello");
    });
  });
});
