import type Database from "better-sqlite3";
import type { RegisteredGroup } from "@nagi/types";

interface GroupRow {
  jid: string;
  name: string;
  folder: string;
  trigger_pattern: string;
  added_at: string;
  container_config: string | null;
  requires_trigger: number | null;
  is_main: number | null;
}

function rowToGroup(row: GroupRow): RegisteredGroup & { jid: string } {
  return {
    jid: row.jid,
    name: row.name,
    folder: row.folder,
    trigger: row.trigger_pattern,
    added_at: row.added_at,
    containerConfig: row.container_config
      ? JSON.parse(row.container_config)
      : undefined,
    requiresTrigger:
      row.requires_trigger === null ? undefined : row.requires_trigger === 1,
    isMain: row.is_main === 1 ? true : undefined,
  };
}

export class GroupRepository {
  constructor(private db: Database.Database) {}

  get(jid: string): (RegisteredGroup & { jid: string }) | undefined {
    const row = this.db
      .prepare("SELECT * FROM registered_groups WHERE jid = ?")
      .get(jid) as GroupRow | undefined;
    if (!row) return undefined;
    return rowToGroup(row);
  }

  set(jid: string, group: RegisteredGroup): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO registered_groups (jid, name, folder, trigger_pattern, added_at, container_config, requires_trigger, is_main)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        jid,
        group.name,
        group.folder,
        group.trigger,
        group.added_at,
        group.containerConfig
          ? JSON.stringify(group.containerConfig)
          : null,
        group.requiresTrigger === undefined
          ? 1
          : group.requiresTrigger
            ? 1
            : 0,
        group.isMain ? 1 : 0,
      );
  }

  getAll(): Record<string, RegisteredGroup> {
    const rows = this.db
      .prepare("SELECT * FROM registered_groups")
      .all() as GroupRow[];
    const result: Record<string, RegisteredGroup> = {};
    for (const row of rows) {
      const group = rowToGroup(row);
      result[row.jid] = {
        name: group.name,
        folder: group.folder,
        trigger: group.trigger,
        added_at: group.added_at,
        containerConfig: group.containerConfig,
        requiresTrigger: group.requiresTrigger,
        isMain: group.isMain,
      };
    }
    return result;
  }
}
