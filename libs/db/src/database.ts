import Database from "better-sqlite3";

import { ChatRepository } from "./repositories/chat.js";
import { MessageRepository } from "./repositories/message.js";
import { TaskRepository } from "./repositories/task.js";
import { SessionRepository } from "./repositories/session.js";
import { GroupRepository } from "./repositories/group.js";
import { StateRepository } from "./repositories/state.js";

export interface CreateDatabaseOptions {
  /** File path for the SQLite database */
  path?: string;
  /** Use in-memory database (for testing) */
  memory?: boolean;
}

export interface NagiDatabase {
  /** Raw better-sqlite3 instance (escape hatch) */
  raw: Database.Database;
  chats: ChatRepository;
  messages: MessageRepository;
  tasks: TaskRepository;
  sessions: SessionRepository;
  groups: GroupRepository;
  state: StateRepository;
  close(): void;
}

function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      jid TEXT PRIMARY KEY,
      name TEXT,
      last_message_time TEXT,
      channel TEXT,
      is_group INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT,
      chat_jid TEXT,
      sender TEXT,
      sender_name TEXT,
      content TEXT,
      timestamp TEXT,
      is_from_me INTEGER,
      is_bot_message INTEGER DEFAULT 0,
      PRIMARY KEY (id, chat_jid),
      FOREIGN KEY (chat_jid) REFERENCES chats(jid)
    );
    CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      group_folder TEXT NOT NULL,
      chat_jid TEXT NOT NULL,
      prompt TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      schedule_value TEXT NOT NULL,
      context_mode TEXT DEFAULT 'isolated',
      next_run TEXT,
      last_run TEXT,
      last_result TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_next_run ON scheduled_tasks(next_run);
    CREATE INDEX IF NOT EXISTS idx_status ON scheduled_tasks(status);

    CREATE TABLE IF NOT EXISTS task_run_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      run_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      FOREIGN KEY (task_id) REFERENCES scheduled_tasks(id)
    );
    CREATE INDEX IF NOT EXISTS idx_task_run_logs ON task_run_logs(task_id, run_at);

    CREATE TABLE IF NOT EXISTS router_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      group_folder TEXT NOT NULL,
      agent_type TEXT NOT NULL,
      session_id TEXT NOT NULL,
      PRIMARY KEY (group_folder, agent_type)
    );
    CREATE TABLE IF NOT EXISTS registered_groups (
      jid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT '',
      folder TEXT NOT NULL,
      trigger_pattern TEXT NOT NULL,
      added_at TEXT NOT NULL,
      container_config TEXT,
      requires_trigger INTEGER DEFAULT 1,
      is_main INTEGER DEFAULT 0,
      UNIQUE(channel, folder)
    );
  `);
}

function runMigrations(db: Database.Database): void {
  // Each migration is idempotent (try/catch for "column already exists")

  try {
    db.exec(
      `ALTER TABLE scheduled_tasks ADD COLUMN context_mode TEXT DEFAULT 'isolated'`,
    );
  } catch {
    /* column already exists */
  }

  try {
    db.exec(
      `ALTER TABLE messages ADD COLUMN is_bot_message INTEGER DEFAULT 0`,
    );
  } catch {
    /* column already exists */
  }

  try {
    db.exec(
      `ALTER TABLE registered_groups ADD COLUMN is_main INTEGER DEFAULT 0`,
    );
    db.exec(
      `UPDATE registered_groups SET is_main = 1 WHERE folder = 'main'`,
    );
  } catch {
    /* column already exists */
  }

  // Migrate sessions table: add agent_type column with composite PK
  try {
    const hasAgentType = db
      .prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('sessions') WHERE name = 'agent_type'")
      .get() as { cnt: number };
    if (hasAgentType.cnt === 0) {
      db.exec(`
        CREATE TABLE sessions_new (
          group_folder TEXT NOT NULL,
          agent_type TEXT NOT NULL,
          session_id TEXT NOT NULL,
          PRIMARY KEY (group_folder, agent_type)
        );
        INSERT OR IGNORE INTO sessions_new (group_folder, agent_type, session_id)
          SELECT group_folder, 'unknown', session_id FROM sessions;
        DROP TABLE sessions;
        ALTER TABLE sessions_new RENAME TO sessions;
      `);
    }
  } catch {
    /* already migrated or fresh DB */
  }

  // Migrate registered_groups: add channel column and backfill from JID prefix
  try {
    const hasChannel = db
      .prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('registered_groups') WHERE name = 'channel'")
      .get() as { cnt: number };
    if (hasChannel.cnt === 0) {
      db.exec(`ALTER TABLE registered_groups ADD COLUMN channel TEXT DEFAULT ''`);
      db.exec(`UPDATE registered_groups SET channel = 'slack' WHERE jid LIKE 'slack:%'`);
      db.exec(`UPDATE registered_groups SET channel = 'discord' WHERE jid LIKE 'dc:%'`);
      db.exec(`UPDATE registered_groups SET channel = 'whatsapp' WHERE jid LIKE '%@g.us' OR jid LIKE '%@s.whatsapp.net'`);
      db.exec(`UPDATE registered_groups SET channel = 'telegram' WHERE jid LIKE 'tg:%'`);
      // Drop old UNIQUE(folder) and add UNIQUE(channel, folder)
      // SQLite requires table recreation for constraint changes
      db.exec(`
        CREATE TABLE registered_groups_new (
          jid TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          channel TEXT NOT NULL DEFAULT '',
          folder TEXT NOT NULL,
          trigger_pattern TEXT NOT NULL,
          added_at TEXT NOT NULL,
          container_config TEXT,
          requires_trigger INTEGER DEFAULT 1,
          is_main INTEGER DEFAULT 0,
          UNIQUE(channel, folder)
        );
        INSERT INTO registered_groups_new SELECT jid, name, channel, folder, trigger_pattern, added_at, container_config, requires_trigger, is_main FROM registered_groups;
        DROP TABLE registered_groups;
        ALTER TABLE registered_groups_new RENAME TO registered_groups;
      `);
    }
  } catch {
    /* already migrated or fresh DB */
  }

  try {
    db.exec(`ALTER TABLE chats ADD COLUMN channel TEXT`);
    db.exec(`ALTER TABLE chats ADD COLUMN is_group INTEGER DEFAULT 0`);
    db.exec(
      `UPDATE chats SET channel = 'whatsapp', is_group = 1 WHERE jid LIKE '%@g.us'`,
    );
    db.exec(
      `UPDATE chats SET channel = 'whatsapp', is_group = 0 WHERE jid LIKE '%@s.whatsapp.net'`,
    );
    db.exec(
      `UPDATE chats SET channel = 'discord', is_group = 1 WHERE jid LIKE 'dc:%'`,
    );
    db.exec(
      `UPDATE chats SET channel = 'telegram', is_group = 1 WHERE jid LIKE 'tg:%'`,
    );
  } catch {
    /* columns already exist */
  }
}

export function createDatabase(opts?: CreateDatabaseOptions): NagiDatabase {
  const db = opts?.memory
    ? new Database(":memory:")
    : new Database(opts?.path ?? ":memory:");

  db.pragma("journal_mode = WAL");
  createSchema(db);
  runMigrations(db);

  return {
    raw: db,
    chats: new ChatRepository(db),
    messages: new MessageRepository(db),
    tasks: new TaskRepository(db),
    sessions: new SessionRepository(db),
    groups: new GroupRepository(db),
    state: new StateRepository(db),
    close() {
      db.close();
    },
  };
}
