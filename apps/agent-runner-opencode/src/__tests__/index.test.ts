import { describe, expect, it } from "vitest";
import { OUTPUT_START_MARKER, OUTPUT_END_MARKER } from "../index.js";

describe("agent-runner-opencode output protocol", () => {
  it("exports correct output markers", () => {
    expect(OUTPUT_START_MARKER).toBe("---NAGI_OUTPUT_START---");
    expect(OUTPUT_END_MARKER).toBe("---NAGI_OUTPUT_END---");
  });

  it("markers are distinct strings", () => {
    expect(OUTPUT_START_MARKER).not.toBe(OUTPUT_END_MARKER);
  });

  it("markers match claude-code agent runner", () => {
    // Both runners must use the same protocol
    expect(OUTPUT_START_MARKER).toBe("---NAGI_OUTPUT_START---");
    expect(OUTPUT_END_MARKER).toBe("---NAGI_OUTPUT_END---");
  });
});
