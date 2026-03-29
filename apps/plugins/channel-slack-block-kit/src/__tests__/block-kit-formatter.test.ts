import { describe, expect, it } from "vitest";
import { formatToBlockKit } from "../block-kit-formatter.js";

describe("formatToBlockKit", () => {
  describe("thinking pattern", () => {
    it("converts thinking message to context block", () => {
      const blocks = formatToBlockKit("💭 Thinking...");
      expect(blocks).not.toBeNull();
      expect(blocks!).toHaveLength(1);
      expect(blocks![0].type).toBe("context");
    });
  });

  describe("tool notification patterns", () => {
    it("converts Bash tool notification", () => {
      const blocks = formatToBlockKit("🔧 `Bash: ls -la /workspace`");
      expect(blocks).not.toBeNull();
      expect(blocks!.length).toBeGreaterThanOrEqual(2);
      expect(blocks![0].type).toBe("context");
    });

    it("converts Read tool notification", () => {
      const blocks = formatToBlockKit("📖 `Read: src/index.ts`");
      expect(blocks).not.toBeNull();
      expect(blocks![0].type).toBe("context");
    });

    it("converts Grep tool notification", () => {
      const blocks = formatToBlockKit("🔍 `Grep: TODO`");
      expect(blocks).not.toBeNull();
    });

    it("converts Edit tool notification", () => {
      const blocks = formatToBlockKit("✏️ `Edit: src/index.ts`");
      expect(blocks).not.toBeNull();
    });

    it("converts MCP tool notification", () => {
      const blocks = formatToBlockKit("🔌 `mcp__ollama__generate: prompt`");
      expect(blocks).not.toBeNull();
    });

    it("converts tool without detail", () => {
      const blocks = formatToBlockKit("⚙️ `Agent`");
      expect(blocks).not.toBeNull();
    });
  });

  describe("passthrough", () => {
    it("returns null for plain text", () => {
      expect(formatToBlockKit("Hello, world!")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(formatToBlockKit("")).toBeNull();
    });

    it("returns null for multiline text", () => {
      expect(formatToBlockKit("line1\nline2")).toBeNull();
    });

    it("returns null for long agent responses", () => {
      expect(
        formatToBlockKit("Here is the summary of what I found in the code..."),
      ).toBeNull();
    });
  });
});
