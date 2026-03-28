import { describe, expect, it, beforeEach } from "vitest";
import { createDatabase, type NagiDatabase } from "../index.js";

let db: NagiDatabase;

beforeEach(() => {
  db = createDatabase({ memory: true });
});

describe("GroupRepository", () => {
  const testGroup = {
    name: "Test Group",
    folder: "test",
    trigger: "!test",
    added_at: "2026-01-01T00:00:00Z",
  };

  it("stores and retrieves a group", () => {
    db.groups.set("dc:123", testGroup);
    const group = db.groups.get("dc:123");
    expect(group).toBeDefined();
    expect(group!.name).toBe("Test Group");
    expect(group!.trigger).toBe("!test");
    expect(group!.jid).toBe("dc:123");
  });

  it("returns undefined for missing group", () => {
    expect(db.groups.get("dc:999")).toBeUndefined();
  });

  it("stores group with containerConfig", () => {
    db.groups.set("dc:123", {
      ...testGroup,
      containerConfig: {
        additionalMounts: [{ hostPath: "/tmp", readonly: true }],
        timeout: 600000,
      },
    });
    const group = db.groups.get("dc:123");
    expect(group!.containerConfig).toEqual({
      additionalMounts: [{ hostPath: "/tmp", readonly: true }],
      timeout: 600000,
    });
  });

  it("stores group with isMain flag", () => {
    db.groups.set("dc:main", { ...testGroup, folder: "main", isMain: true });
    const group = db.groups.get("dc:main");
    expect(group!.isMain).toBe(true);
  });

  it("gets all groups as record", () => {
    db.groups.set("dc:1", testGroup);
    db.groups.set("dc:2", { ...testGroup, name: "Other", folder: "other" });
    const all = db.groups.getAll();
    expect(Object.keys(all)).toHaveLength(2);
    expect(all["dc:1"].name).toBe("Test Group");
    expect(all["dc:2"].name).toBe("Other");
  });

  it("overwrites existing group", () => {
    db.groups.set("dc:123", testGroup);
    db.groups.set("dc:123", { ...testGroup, name: "Updated" });
    expect(db.groups.get("dc:123")!.name).toBe("Updated");
  });
});
