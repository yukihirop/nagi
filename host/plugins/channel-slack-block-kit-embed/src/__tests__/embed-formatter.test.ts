import { describe, expect, it } from "vitest";
import { formatEmbedAttachment } from "../embed-formatter.js";

describe("formatEmbedAttachment", () => {
  describe("thinking indicator", () => {
    it("returns gray attachment with italic label", () => {
      const a = formatEmbedAttachment("💭 Thinking...");
      expect(a.color).toBe("#95A5A6");
      expect(a.text).toBe("💭 _Thinking..._");
      expect(a.fallback).toBe("Thinking...");
      expect(a.mrkdwn_in).toContain("text");
      expect(a.title).toBeUndefined();
    });
  });

  describe("cost footer", () => {
    it("uses gray color and keeps full cost string in text", () => {
      const a = formatEmbedAttachment(
        "💰 `anthropic/claude-sonnet-4-6 (Max Plan) | $0.0927 | 3 in / 55 out`",
      );
      expect(a.color).toBe("#95A5A6");
      expect(a.text).toBe(
        "💰 `anthropic/claude-sonnet-4-6 (Max Plan) | $0.0927 | 3 in / 55 out`",
      );
      expect(a.title).toBeUndefined();
      expect(a.fallback).toContain("💰");
    });
  });

  describe("tool notifications", () => {
    it("renders Bash with title + detail", () => {
      const a = formatEmbedAttachment("🔧 `Bash: ls -la /workspace`");
      expect(a.color).toBe("#4A9FFF");
      expect(a.title).toBe("🔧 Bash");
      expect(a.text).toBe("`ls -la /workspace`");
      expect(a.mrkdwn_in).toContain("text");
    });

    it("renders Read with green color", () => {
      const a = formatEmbedAttachment("📖 `Read: src/index.ts`");
      expect(a.color).toBe("#50C878");
      expect(a.title).toBe("📖 Read");
      expect(a.text).toBe("`src/index.ts`");
    });

    it("renders mcp__ tool with display name breadcrumb", () => {
      const a = formatEmbedAttachment("🔌 `mcp__ollama__generate: prompt`");
      expect(a.color).toBe("#8E44AD");
      expect(a.title).toBe("🔌 ollama › generate");
      expect(a.text).toBe("`prompt`");
    });

    it("renders tool without detail (no colon) as title only", () => {
      const a = formatEmbedAttachment("⚙️ `Agent`");
      expect(a.color).toBe("#9B59B6");
      expect(a.title).toBe("⚙️ Agent");
      expect(a.text).toBeUndefined();
    });

    it("unknown tool falls back to default gray", () => {
      const a = formatEmbedAttachment("⚙️ `UnknownTool: detail`");
      expect(a.color).toBe("#95A5A6");
      expect(a.title).toBe("⚙️ UnknownTool");
      expect(a.text).toBe("`detail`");
    });
  });

  describe("agent reply (markdown body)", () => {
    it("uses blurple for plain text", () => {
      const a = formatEmbedAttachment("こんばんは！何かお手伝いできることはありますか？");
      expect(a.color).toBe("#5865F2");
      expect(a.text).toBe("こんばんは！何かお手伝いできることはありますか？");
      expect(a.title).toBeUndefined();
    });

    it("converts **bold** to mrkdwn *bold*", () => {
      const a = formatEmbedAttachment("this is **important** text");
      expect(a.text).toBe("this is *important* text");
    });

    it("converts markdown headers to bold lines", () => {
      const a = formatEmbedAttachment("## Section title\n\nbody text");
      expect(a.text).toBe("*Section title*\n\nbody text");
    });

    it("converts markdown links to mrkdwn links", () => {
      const a = formatEmbedAttachment("see [docs](https://example.com) here");
      expect(a.text).toBe("see <https://example.com|docs> here");
    });

    it("empty string still produces an attachment", () => {
      const a = formatEmbedAttachment("");
      expect(a.color).toBe("#5865F2");
      expect(a.text).toBe("");
    });
  });
});
