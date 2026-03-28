import { describe, expect, it, beforeEach } from "vitest";
import { createDatabase, type NagiDatabase } from "../index.js";

let db: NagiDatabase;

beforeEach(() => {
  db = createDatabase({ memory: true });
});

describe("SessionRepository", () => {
  it("stores and retrieves a session", () => {
    db.sessions.set("main", "session-abc");
    expect(db.sessions.get("main")).toBe("session-abc");
  });

  it("returns undefined for missing session", () => {
    expect(db.sessions.get("nonexistent")).toBeUndefined();
  });

  it("overwrites existing session", () => {
    db.sessions.set("main", "old");
    db.sessions.set("main", "new");
    expect(db.sessions.get("main")).toBe("new");
  });

  it("gets all sessions", () => {
    db.sessions.set("main", "s1");
    db.sessions.set("other", "s2");
    expect(db.sessions.getAll()).toEqual({ main: "s1", other: "s2" });
  });

  it("returns empty object when no sessions", () => {
    expect(db.sessions.getAll()).toEqual({});
  });
});
