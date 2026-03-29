import { describe, expect, it } from "vitest";
import {
  formatToolNotification,
  formatMarkdownToBlockKit,
} from "../block-kit-formatter.js";

describe("formatToolNotification", () => {
  describe("thinking pattern", () => {
    it("converts thinking message to context block", () => {
      const blocks = formatToolNotification("💭 Thinking...");
      expect(blocks).not.toBeNull();
      expect(blocks!).toHaveLength(2);
      expect(blocks![0].type).toBe("context");
      expect(blocks![1].type).toBe("divider");
    });
  });

  describe("tool notification patterns", () => {
    it("converts Bash tool notification", () => {
      const blocks = formatToolNotification("🔧 `Bash: ls -la /workspace`");
      expect(blocks).not.toBeNull();
      expect(blocks!.length).toBeGreaterThanOrEqual(2);
      expect(blocks![0].type).toBe("context");
    });

    it("converts Read tool notification", () => {
      const blocks = formatToolNotification("📖 `Read: src/index.ts`");
      expect(blocks).not.toBeNull();
    });

    it("converts tool without detail", () => {
      const blocks = formatToolNotification("⚙️ `Agent`");
      expect(blocks).not.toBeNull();
    });
  });

  describe("passthrough", () => {
    it("returns null for plain text", () => {
      expect(formatToolNotification("Hello, world!")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(formatToolNotification("")).toBeNull();
    });

    it("returns null for multiline text", () => {
      expect(formatToolNotification("line1\nline2")).toBeNull();
    });
  });
});

describe("formatMarkdownToBlockKit", () => {
  it("converts headers to header blocks", () => {
    const blocks = formatMarkdownToBlockKit("### Hello World");
    expect(blocks[0].type).toBe("header");
  });

  it("converts --- to divider blocks", () => {
    const blocks = formatMarkdownToBlockKit("text\n\n---\n\nmore text");
    const dividers = blocks.filter((b) => b.type === "divider");
    expect(dividers.length).toBeGreaterThanOrEqual(1);
  });

  it("converts **bold** to *bold*", () => {
    const blocks = formatMarkdownToBlockKit("This is **bold** text");
    const section = blocks.find((b) => b.type === "section");
    expect(section).toBeDefined();
    if (section && "text" in section && section.text) {
      expect(section.text.text).toContain("*bold*");
      expect(section.text.text).not.toContain("**bold**");
    }
  });

  it("converts markdown links to Slack format", () => {
    const blocks = formatMarkdownToBlockKit("[Google](https://google.com)");
    const section = blocks.find((b) => b.type === "section");
    expect(section).toBeDefined();
    if (section && "text" in section && section.text) {
      expect(section.text.text).toContain("<https://google.com|Google>");
    }
  });

  it("converts tables to code blocks", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const blocks = formatMarkdownToBlockKit(md);
    const section = blocks.find((b) => b.type === "section");
    expect(section).toBeDefined();
    if (section && "text" in section && section.text) {
      expect(section.text.text).toContain("```");
    }
  });

  it("handles mixed content with headers, tables, and text", () => {
    const md = [
      "### Weather",
      "",
      "| Item | Value |",
      "|---|---|",
      "| Temp | 23°C |",
      "",
      "---",
      "",
      "### Notes",
      "- It's sunny",
      "- Bring sunscreen",
    ].join("\n");

    const blocks = formatMarkdownToBlockKit(md);
    const types = blocks.map((b) => b.type);
    expect(types).toContain("header");
    expect(types).toContain("divider");
    expect(types).toContain("section");
  });

  it("returns at least one block for empty input", () => {
    const blocks = formatMarkdownToBlockKit("");
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });
});
