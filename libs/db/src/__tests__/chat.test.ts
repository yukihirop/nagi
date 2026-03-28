import { describe, expect, it, beforeEach } from "vitest";
import { createDatabase, type NagiDatabase } from "../index.js";

let db: NagiDatabase;

beforeEach(() => {
  db = createDatabase({ memory: true });
});

describe("ChatRepository", () => {
  it("stores and retrieves chat metadata with name", () => {
    db.chats.storeChatMetadata("dc:123", "2026-01-01T00:00:00Z", "General", "discord", true);
    const chats = db.chats.getAll();
    expect(chats).toHaveLength(1);
    expect(chats[0].jid).toBe("dc:123");
    expect(chats[0].name).toBe("General");
    expect(chats[0].channel).toBe("discord");
    expect(chats[0].is_group).toBe(1);
  });

  it("stores chat without name using jid as fallback", () => {
    db.chats.storeChatMetadata("dc:456", "2026-01-01T00:00:00Z");
    const chats = db.chats.getAll();
    expect(chats[0].name).toBe("dc:456");
  });

  it("preserves newer timestamp on conflict", () => {
    db.chats.storeChatMetadata("dc:123", "2026-01-02T00:00:00Z", "A");
    db.chats.storeChatMetadata("dc:123", "2026-01-01T00:00:00Z", "B");
    const chats = db.chats.getAll();
    expect(chats[0].last_message_time).toBe("2026-01-02T00:00:00Z");
    expect(chats[0].name).toBe("B");
  });

  it("updateChatName updates name only", () => {
    db.chats.storeChatMetadata("dc:123", "2026-01-01T00:00:00Z", "Old");
    db.chats.updateChatName("dc:123", "New");
    const chats = db.chats.getAll();
    expect(chats[0].name).toBe("New");
  });

  it("orders chats by most recent first", () => {
    db.chats.storeChatMetadata("dc:1", "2026-01-01T00:00:00Z", "Old");
    db.chats.storeChatMetadata("dc:2", "2026-01-03T00:00:00Z", "New");
    db.chats.storeChatMetadata("dc:3", "2026-01-02T00:00:00Z", "Mid");
    const chats = db.chats.getAll();
    expect(chats.map((c) => c.jid)).toEqual(["dc:2", "dc:3", "dc:1"]);
  });

  it("tracks group sync timestamp", () => {
    expect(db.chats.getLastGroupSync()).toBeNull();
    db.chats.setLastGroupSync();
    expect(db.chats.getLastGroupSync()).toBeTruthy();
  });
});
