import { describe, expect, it, beforeEach } from "vitest";
import { createDatabase, type NagiDatabase } from "../index.js";

let db: NagiDatabase;

beforeEach(() => {
  db = createDatabase({ memory: true });
});

describe("StateRepository", () => {
  it("stores and retrieves state", () => {
    db.state.set("last_timestamp", "2026-01-01T00:00:00Z");
    expect(db.state.get("last_timestamp")).toBe("2026-01-01T00:00:00Z");
  });

  it("returns undefined for missing key", () => {
    expect(db.state.get("nonexistent")).toBeUndefined();
  });

  it("overwrites existing state", () => {
    db.state.set("key", "old");
    db.state.set("key", "new");
    expect(db.state.get("key")).toBe("new");
  });

  it("stores JSON values", () => {
    const data = { chat1: "ts1", chat2: "ts2" };
    db.state.set("last_agent_timestamp", JSON.stringify(data));
    expect(JSON.parse(db.state.get("last_agent_timestamp")!)).toEqual(data);
  });
});
