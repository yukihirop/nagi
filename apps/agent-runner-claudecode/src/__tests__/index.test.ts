import { describe, expect, it } from "vitest";
import { OUTPUT_START_MARKER, OUTPUT_END_MARKER } from "../index.js";

describe("agent-runner output protocol", () => {
  it("exports correct output markers", () => {
    expect(OUTPUT_START_MARKER).toBe("---NAGI_OUTPUT_START---");
    expect(OUTPUT_END_MARKER).toBe("---NAGI_OUTPUT_END---");
  });

  it("markers are distinct strings", () => {
    expect(OUTPUT_START_MARKER).not.toBe(OUTPUT_END_MARKER);
  });

  it("markers can be used to parse output", () => {
    const output = [
      "some log line",
      OUTPUT_START_MARKER,
      '{"status":"success","result":"hello"}',
      OUTPUT_END_MARKER,
      "more log",
    ].join("\n");

    const startIdx = output.indexOf(OUTPUT_START_MARKER);
    const endIdx = output.indexOf(OUTPUT_END_MARKER);
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(endIdx).toBeGreaterThan(startIdx);

    const jsonStr = output
      .slice(startIdx + OUTPUT_START_MARKER.length, endIdx)
      .trim();
    const parsed = JSON.parse(jsonStr);
    expect(parsed.status).toBe("success");
    expect(parsed.result).toBe("hello");
  });
});
