import type { RegisteredGroup } from "@nagi/types";
import type { NagiDatabase } from "@nagi/db";
import { createLogger } from "@nagi/logger";

const logger = createLogger({ name: "orchestrator" });

/**
 * Centralized application state.
 * Replaces the scattered module-scope variables from the original index.ts.
 */
export class AppState {
  lastTimestamp: string = "";
  lastAgentTimestamp: Record<string, string> = {};
  sessions: Record<string, string> = {};
  registeredGroups: Record<string, RegisteredGroup> = {};

  load(db: NagiDatabase): void {
    // Load registered groups
    this.registeredGroups = db.groups.getAll();

    // Load sessions
    this.sessions = db.sessions.getAll();

    // Load router state
    this.lastTimestamp = db.state.get("last_timestamp") ?? "";
    const agentTimestampJson = db.state.get("last_agent_timestamp");
    this.lastAgentTimestamp = agentTimestampJson
      ? JSON.parse(agentTimestampJson)
      : {};

    const groupCount = Object.keys(this.registeredGroups).length;
    const sessionCount = Object.keys(this.sessions).length;
    logger.info(
      { groupCount, sessionCount, lastTimestamp: this.lastTimestamp },
      "State loaded",
    );
  }

  saveTimestamps(db: NagiDatabase): void {
    db.state.set("last_timestamp", this.lastTimestamp);
    db.state.set(
      "last_agent_timestamp",
      JSON.stringify(this.lastAgentTimestamp),
    );
  }

  registerGroup(
    db: NagiDatabase,
    jid: string,
    group: RegisteredGroup,
  ): void {
    db.groups.set(jid, group);
    this.registeredGroups[jid] = group;
    logger.info({ jid, name: group.name, folder: group.folder }, "Group registered");
  }

  updateSession(
    db: NagiDatabase,
    groupFolder: string,
    sessionId: string,
  ): void {
    db.sessions.set(groupFolder, sessionId);
    this.sessions[groupFolder] = sessionId;
  }
}
