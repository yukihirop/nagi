import { describe, expect, it, beforeEach } from "vitest";
import { createDatabase, type NagiDatabase } from "@nagi/db";
import { AppState } from "../state.js";

let db: NagiDatabase;

beforeEach(() => {
  db = createDatabase({ memory: true });
});

describe("AppState", () => {
  it("loads empty state from fresh db", () => {
    const state = new AppState();
    state.load(db);
    expect(state.lastTimestamp).toBe("");
    expect(state.sessions).toEqual({});
    expect(state.registeredGroups).toEqual({});
    expect(state.lastAgentTimestamp).toEqual({});
  });

  it("saves and reloads timestamps", () => {
    const state = new AppState();
    state.load(db);

    state.lastTimestamp = "2026-01-01T00:00:00Z";
    state.lastAgentTimestamp = { "dc:123": "2026-01-01T01:00:00Z" };
    state.saveTimestamps(db);

    const state2 = new AppState();
    state2.load(db);
    expect(state2.lastTimestamp).toBe("2026-01-01T00:00:00Z");
    expect(state2.lastAgentTimestamp).toEqual({
      "dc:123": "2026-01-01T01:00:00Z",
    });
  });

  it("registers and reloads groups", () => {
    const state = new AppState();
    state.load(db);

    state.registerGroup(db, "dc:123", {
      name: "Test",
      folder: "test",
      trigger: "!test",
      added_at: "2026-01-01T00:00:00Z",
    });

    const state2 = new AppState();
    state2.load(db);
    expect(state2.registeredGroups["dc:123"]).toBeDefined();
    expect(state2.registeredGroups["dc:123"].name).toBe("Test");
  });

  it("updates and reloads sessions", () => {
    const state = new AppState();
    state.load(db);

    state.updateSession(db, "test", "session-abc");

    const state2 = new AppState();
    state2.load(db);
    expect(state2.sessions["test"]).toBe("session-abc");
  });
});
