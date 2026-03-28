import { describe, expect, it, vi, afterEach } from "vitest";
import { setupGlobalErrorHandlers } from "../index.js";

describe("setupGlobalErrorHandlers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers uncaughtException and unhandledRejection handlers", () => {
    const processOnSpy = vi.spyOn(process, "on");
    const fakeLogger = {
      fatal: vi.fn(),
      error: vi.fn(),
    } as never;

    setupGlobalErrorHandlers(fakeLogger);

    expect(processOnSpy).toHaveBeenCalledWith(
      "uncaughtException",
      expect.any(Function)
    );
    expect(processOnSpy).toHaveBeenCalledWith(
      "unhandledRejection",
      expect.any(Function)
    );
  });
});
