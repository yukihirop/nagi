import { describe, expect, it, beforeEach } from "vitest";
import { createDatabase, type NagiDatabase } from "../index.js";

let db: NagiDatabase;

beforeEach(() => {
  db = createDatabase({ memory: true });
});

describe("SessionRepository", () => {
  it("stores and retrieves a session by agent type", () => {
    db.sessions.set("main", "claude-code", "session-abc");
    expect(db.sessions.get("main", "claude-code")).toBe("session-abc");
  });

  it("returns undefined for missing session", () => {
    expect(db.sessions.get("nonexistent", "claude-code")).toBeUndefined();
  });

  it("returns undefined for wrong agent type", () => {
    db.sessions.set("main", "claude-code", "session-abc");
    expect(db.sessions.get("main", "open-code")).toBeUndefined();
  });

  it("overwrites existing session for same agent type", () => {
    db.sessions.set("main", "claude-code", "old");
    db.sessions.set("main", "claude-code", "new");
    expect(db.sessions.get("main", "claude-code")).toBe("new");
  });

  it("stores separate sessions per agent type", () => {
    db.sessions.set("main", "claude-code", "cc-session");
    db.sessions.set("main", "open-code", "oc-session");
    expect(db.sessions.get("main", "claude-code")).toBe("cc-session");
    expect(db.sessions.get("main", "open-code")).toBe("oc-session");
  });

  it("gets all sessions for a specific agent type", () => {
    db.sessions.set("main", "claude-code", "s1");
    db.sessions.set("other", "claude-code", "s2");
    db.sessions.set("main", "open-code", "s3");
    expect(db.sessions.getAllForAgent("claude-code")).toEqual({ main: "s1", other: "s2" });
    expect(db.sessions.getAllForAgent("open-code")).toEqual({ main: "s3" });
  });

  it("returns empty object when no sessions for agent type", () => {
    expect(db.sessions.getAllForAgent("claude-code")).toEqual({});
  });
});
