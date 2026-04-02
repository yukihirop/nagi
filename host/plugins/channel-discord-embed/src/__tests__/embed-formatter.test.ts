import { describe, expect, it } from "vitest";
import { formatToolNotification, formatMarkdownToEmbeds } from "../embed-formatter.js";

describe("formatToolNotification", () => {
  it("converts thinking message", () => {
    const embeds = formatToolNotification("💭 Thinking...");
    expect(embeds).not.toBeNull();
    expect(embeds!).toHaveLength(1);
    expect(embeds![0].data.description).toContain("Thinking");
  });

  it("converts Bash tool notification", () => {
    const embeds = formatToolNotification("🔧 `Bash: ls -la /workspace`");
    expect(embeds).not.toBeNull();
    expect(embeds!).toHaveLength(1);
    expect(embeds![0].data.title).toContain("Bash");
    expect(embeds![0].data.description).toContain("ls -la");
  });

  it("converts tool without detail", () => {
    const embeds = formatToolNotification("⚙️ `Agent`");
    expect(embeds).not.toBeNull();
    expect(embeds![0].data.title).toContain("Agent");
    expect(embeds![0].data.description).toBeUndefined();
  });

  it("converts MCP tool", () => {
    const embeds = formatToolNotification("🔌 `mcp__ollama__generate: prompt`");
    expect(embeds).not.toBeNull();
    expect(embeds![0].data.title).toContain("ollama");
  });

  it("returns null for plain text", () => {
    expect(formatToolNotification("Hello world")).toBeNull();
  });

  it("returns null for multiline", () => {
    expect(formatToolNotification("line1\nline2")).toBeNull();
  });
});

describe("formatMarkdownToEmbeds", () => {
  it("converts headers to embed titles", () => {
    const embeds = formatMarkdownToEmbeds("### Weather Report");
    expect(embeds[0].data.title).toBe("Weather Report");
  });

  it("splits on --- into separate embeds", () => {
    const embeds = formatMarkdownToEmbeds("Part 1\n\n---\n\nPart 2");
    expect(embeds.length).toBeGreaterThanOrEqual(2);
  });

  it("converts tables to code blocks", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const embeds = formatMarkdownToEmbeds(md);
    expect(embeds[0].data.description).toContain("```");
  });

  it("preserves markdown formatting", () => {
    const embeds = formatMarkdownToEmbeds("**bold** and [link](https://example.com)");
    expect(embeds[0].data.description).toContain("**bold**");
    expect(embeds[0].data.description).toContain("[link](https://example.com)");
  });

  it("returns at least one embed for empty input", () => {
    expect(formatMarkdownToEmbeds("").length).toBeGreaterThanOrEqual(1);
  });

  it("handles mixed content", () => {
    const md = "### Title\nSome text\n| A | B |\n|---|---|\n| 1 | 2 |\n---\n### Section 2\nMore text";
    const embeds = formatMarkdownToEmbeds(md);
    expect(embeds.length).toBeGreaterThanOrEqual(2);
  });
});
