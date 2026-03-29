import type Database from "better-sqlite3";

export class SessionRepository {
  constructor(private db: Database.Database) {}

  get(groupFolder: string, agentType: string): string | undefined {
    const row = this.db
      .prepare("SELECT session_id FROM sessions WHERE group_folder = ? AND agent_type = ?")
      .get(groupFolder, agentType) as { session_id: string } | undefined;
    return row?.session_id;
  }

  set(groupFolder: string, agentType: string, sessionId: string): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO sessions (group_folder, agent_type, session_id) VALUES (?, ?, ?)",
      )
      .run(groupFolder, agentType, sessionId);
  }

  getAllForAgent(agentType: string): Record<string, string> {
    const rows = this.db
      .prepare("SELECT group_folder, session_id FROM sessions WHERE agent_type = ?")
      .all(agentType) as Array<{ group_folder: string; session_id: string }>;
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.group_folder] = row.session_id;
    }
    return result;
  }
}
