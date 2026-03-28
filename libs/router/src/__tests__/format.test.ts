import { describe, expect, it } from "vitest";
import {
  escapeXml,
  formatMessages,
  formatOutbound,
  stripInternalTags,
  formatLocalTime,
} from "../index.js";

describe("escapeXml", () => {
  it("escapes special characters", () => {
    expect(escapeXml('a & b < c > d "e"')).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot;",
    );
  });

  it("returns empty string for falsy input", () => {
    expect(escapeXml("")).toBe("");
  });
});

describe("formatLocalTime", () => {
  it("converts UTC to local time string", () => {
    const result = formatLocalTime("2026-01-15T12:00:00Z", "America/New_York");
    expect(result).toContain("Jan");
    expect(result).toContain("2026");
  });
});

describe("formatMessages", () => {
  it("formats messages as XML", () => {
    const messages = [
      {
        id: "1",
        chat_jid: "dc:123",
        sender: "user1",
        sender_name: "Alice",
        content: "hello",
        timestamp: "2026-01-15T12:00:00Z",
      },
    ];
    const result = formatMessages(messages, "UTC");
    expect(result).toContain('<context timezone="UTC" />');
    expect(result).toContain("<messages>");
    expect(result).toContain('sender="Alice"');
    expect(result).toContain("hello");
  });

  it("escapes XML in message content", () => {
    const messages = [
      {
        id: "1",
        chat_jid: "dc:123",
        sender: "u",
        sender_name: "Bob",
        content: "a < b & c",
        timestamp: "2026-01-15T12:00:00Z",
      },
    ];
    const result = formatMessages(messages, "UTC");
    expect(result).toContain("a &lt; b &amp; c");
  });
});

describe("stripInternalTags", () => {
  it("removes internal tags", () => {
    expect(stripInternalTags("hello <internal>secret</internal> world")).toBe(
      "hello  world",
    );
  });

  it("removes multiline internal tags", () => {
    expect(
      stripInternalTags("before <internal>\nline1\nline2\n</internal> after"),
    ).toBe("before  after");
  });

  it("returns text unchanged when no internal tags", () => {
    expect(stripInternalTags("just text")).toBe("just text");
  });
});

describe("formatOutbound", () => {
  it("strips internal tags and trims", () => {
    expect(formatOutbound("hi <internal>x</internal> there")).toBe(
      "hi  there",
    );
  });

  it("returns empty string when only internal tags", () => {
    expect(formatOutbound("<internal>only this</internal>")).toBe("");
  });
});
