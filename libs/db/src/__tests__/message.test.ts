import { describe, expect, it, beforeEach } from "vitest";
import { createDatabase, type NagiDatabase } from "../index.js";

let db: NagiDatabase;

beforeEach(() => {
  db = createDatabase({ memory: true });
  // Ensure chat exists for FK
  db.chats.storeChatMetadata("dc:123", "2026-01-01T00:00:00Z", "Test");
  db.chats.storeChatMetadata("dc:456", "2026-01-01T00:00:00Z", "Other");
});

describe("MessageRepository", () => {
  it("stores and retrieves messages", () => {
    db.messages.store({
      id: "msg-1",
      chat_jid: "dc:123",
      sender: "user1",
      sender_name: "Alice",
      content: "hello",
      timestamp: "2026-01-01T00:01:00Z",
    });

    const result = db.messages.getNew(
      ["dc:123"],
      "2026-01-01T00:00:00Z",
      "Bot",
    );
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe("hello");
    expect(result.newTimestamp).toBe("2026-01-01T00:01:00Z");
  });

  it("filters bot messages", () => {
    db.messages.store({
      id: "msg-1",
      chat_jid: "dc:123",
      sender: "user1",
      sender_name: "Alice",
      content: "hello",
      timestamp: "2026-01-01T00:01:00Z",
    });
    db.messages.store({
      id: "msg-2",
      chat_jid: "dc:123",
      sender: "bot",
      sender_name: "Bot",
      content: "Bot: response",
      timestamp: "2026-01-01T00:02:00Z",
      is_bot_message: true,
    });

    const result = db.messages.getNew(
      ["dc:123"],
      "2026-01-01T00:00:00Z",
      "Bot",
    );
    expect(result.messages).toHaveLength(1);
  });

  it("returns empty for no jids", () => {
    const result = db.messages.getNew([], "2026-01-01T00:00:00Z", "Bot");
    expect(result.messages).toEqual([]);
  });

  it("getSince returns messages for a single chat", () => {
    db.messages.store({
      id: "msg-1",
      chat_jid: "dc:123",
      sender: "user1",
      sender_name: "Alice",
      content: "hello",
      timestamp: "2026-01-01T00:01:00Z",
    });
    db.messages.store({
      id: "msg-2",
      chat_jid: "dc:456",
      sender: "user2",
      sender_name: "Bob",
      content: "other",
      timestamp: "2026-01-01T00:02:00Z",
    });

    const msgs = db.messages.getSince(
      "dc:123",
      "2026-01-01T00:00:00Z",
      "Bot",
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0].chat_jid).toBe("dc:123");
  });
});
