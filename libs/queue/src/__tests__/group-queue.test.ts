import { describe, expect, it, vi, beforeEach } from "vitest";
import os from "node:os";
import path from "node:path";
import { GroupQueue } from "../index.js";

const dataDir = path.join(os.tmpdir(), "nagi-queue-test");

function createQueue(maxConcurrent = 5): GroupQueue {
  return new GroupQueue({ maxConcurrent, dataDir });
}

describe("GroupQueue", () => {
  describe("enqueueMessageCheck", () => {
    it("calls processMessagesFn when slot available", async () => {
      const queue = createQueue();
      const processFn = vi.fn().mockResolvedValue(true);
      queue.setProcessMessagesFn(processFn);

      queue.enqueueMessageCheck("dc:123");

      // Wait for async execution
      await vi.waitFor(() => {
        expect(processFn).toHaveBeenCalledWith("dc:123");
      });
    });

    it("queues when at concurrency limit", async () => {
      const queue = createQueue(1);
      let resolveFirst: () => void;
      const firstPromise = new Promise<boolean>((resolve) => {
        resolveFirst = () => resolve(true);
      });
      const processFn = vi.fn().mockReturnValueOnce(firstPromise).mockResolvedValue(true);
      queue.setProcessMessagesFn(processFn);

      // First fills the slot
      queue.enqueueMessageCheck("dc:1");
      // Second should be queued
      queue.enqueueMessageCheck("dc:2");

      // Only first should have been called so far
      expect(processFn).toHaveBeenCalledTimes(1);

      // Release first
      resolveFirst!();
      await vi.waitFor(() => {
        expect(processFn).toHaveBeenCalledTimes(2);
      });
    });

    it("does nothing after shutdown", () => {
      const queue = createQueue();
      const processFn = vi.fn().mockResolvedValue(true);
      queue.setProcessMessagesFn(processFn);

      queue.shutdown(0);
      queue.enqueueMessageCheck("dc:123");

      expect(processFn).not.toHaveBeenCalled();
    });
  });

  describe("enqueueTask", () => {
    it("runs task immediately when slot available", async () => {
      const queue = createQueue();
      const taskFn = vi.fn().mockResolvedValue(undefined);

      queue.enqueueTask("dc:123", "task-1", taskFn);

      await vi.waitFor(() => {
        expect(taskFn).toHaveBeenCalled();
      });
    });

    it("prevents duplicate task queueing", async () => {
      const queue = createQueue(1);
      let resolveFirst: () => void;
      const firstTask = new Promise<void>((resolve) => {
        resolveFirst = () => resolve();
      });
      const taskFn1 = vi.fn().mockReturnValue(firstTask);
      const taskFn2 = vi.fn().mockResolvedValue(undefined);

      queue.enqueueTask("dc:123", "task-1", taskFn1);
      // Same task ID should be skipped (running)
      queue.enqueueTask("dc:123", "task-1", taskFn2);

      expect(taskFn2).not.toHaveBeenCalled();

      resolveFirst!();
      await vi.waitFor(() => {
        expect(taskFn1).toHaveBeenCalledTimes(1);
      });
    });

    it("does nothing after shutdown", () => {
      const queue = createQueue();
      const taskFn = vi.fn().mockResolvedValue(undefined);

      queue.shutdown(0);
      queue.enqueueTask("dc:123", "task-1", taskFn);

      expect(taskFn).not.toHaveBeenCalled();
    });
  });

  describe("drainGroup", () => {
    it("prioritizes tasks over messages", async () => {
      const queue = createQueue(1);
      const callOrder: string[] = [];

      let resolveMsg: () => void;
      const msgPromise = new Promise<boolean>((resolve) => {
        resolveMsg = () => {
          callOrder.push("msg");
          resolve(true);
        };
      });
      const processFn = vi
        .fn()
        .mockReturnValueOnce(msgPromise)
        .mockImplementation(async () => {
          callOrder.push("msg-drain");
          return true;
        });
      queue.setProcessMessagesFn(processFn);

      // Start message processing (fills slot)
      queue.enqueueMessageCheck("dc:1");
      // Queue a task and more messages while active
      queue.enqueueTask("dc:1", "task-1", async () => {
        callOrder.push("task");
      });
      queue.enqueueMessageCheck("dc:1");

      // Release message processing
      resolveMsg!();

      await vi.waitFor(() => {
        expect(callOrder).toContain("task");
      });
      // Task should run before drain messages
      const taskIdx = callOrder.indexOf("task");
      const msgDrainIdx = callOrder.indexOf("msg-drain");
      if (msgDrainIdx >= 0) {
        expect(taskIdx).toBeLessThan(msgDrainIdx);
      }
    });
  });

  describe("shutdown", () => {
    it("sets shuttingDown flag", async () => {
      const queue = createQueue();
      await queue.shutdown(0);

      const processFn = vi.fn().mockResolvedValue(true);
      queue.setProcessMessagesFn(processFn);
      queue.enqueueMessageCheck("dc:123");

      expect(processFn).not.toHaveBeenCalled();
    });
  });
});
