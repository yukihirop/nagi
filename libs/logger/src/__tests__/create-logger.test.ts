import { describe, expect, it } from "vitest";
import { createLogger } from "../index.js";

describe("createLogger", () => {
  it("creates a logger with default options", () => {
    const logger = createLogger();
    expect(logger).toBeDefined();
    expect(logger.level).toBe("info");
  });

  it("respects the level option", () => {
    const logger = createLogger({ level: "debug" });
    expect(logger.level).toBe("debug");
  });

  it("respects the name option", () => {
    const logger = createLogger({ name: "test-app", pretty: false });
    const bindings = logger.bindings();
    expect(bindings.name).toBe("test-app");
  });

  it("creates a child logger", () => {
    const logger = createLogger({ pretty: false });
    const child = logger.child({ module: "ipc" });
    expect(child).toBeDefined();
    const bindings = child.bindings();
    expect(bindings.module).toBe("ipc");
  });

  it("supports JSON output when pretty is false", () => {
    const logger = createLogger({ pretty: false });
    expect(logger).toBeDefined();
  });
});
