import { describe, expect, it } from "vitest";
import { stripHtml } from "../mention-parser.js";

describe("stripHtml", () => {
  it("returns empty string for empty input", () => {
    expect(stripHtml(undefined)).toBe("");
    expect(stripHtml("")).toBe("");
  });

  it("replaces mention anchors with their label", () => {
    const html = `<body>Hi <a data-asana-gid="42">@Me</a>, please review</body>`;
    expect(stripHtml(html)).toBe("Hi @Me, please review");
  });

  it("drops non-mention tags but keeps text", () => {
    const html = `<body><p>line1</p><p>line2</p></body>`;
    const result = stripHtml(html);
    expect(result).toContain("line1");
    expect(result).toContain("line2");
    expect(result).not.toContain("<p>");
  });

  it("decodes common html entities", () => {
    const html = `<body>a &amp; b &lt;c&gt; &quot;d&quot;</body>`;
    expect(stripHtml(html)).toBe('a & b <c> "d"');
  });

  it("keeps plain-text trigger tokens intact", () => {
    const html = `<body>@ai 何かテストメッセージ</body>`;
    expect(stripHtml(html)).toBe("@ai 何かテストメッセージ");
  });
});
