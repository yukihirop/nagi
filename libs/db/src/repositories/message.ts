import type Database from "better-sqlite3";
import type { NewMessage } from "@nagi/types";

export class MessageRepository {
  constructor(private db: Database.Database) {}

  store(msg: NewMessage): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO messages (id, chat_jid, sender, sender_name, content, timestamp, is_from_me, is_bot_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        msg.id,
        msg.chat_jid,
        msg.sender,
        msg.sender_name,
        msg.content,
        msg.timestamp,
        msg.is_from_me ? 1 : 0,
        msg.is_bot_message ? 1 : 0,
      );
  }

  getNew(
    jids: string[],
    lastTimestamp: string,
    botPrefix: string,
    limit: number = 200,
  ): { messages: NewMessage[]; newTimestamp: string } {
    if (jids.length === 0) return { messages: [], newTimestamp: lastTimestamp };

    const placeholders = jids.map(() => "?").join(",");
    const sql = `
      SELECT * FROM (
        SELECT id, chat_jid, sender, sender_name, content, timestamp, is_from_me
        FROM messages
        WHERE timestamp > ? AND chat_jid IN (${placeholders})
          AND is_bot_message = 0 AND content NOT LIKE ?
          AND content != '' AND content IS NOT NULL
        ORDER BY timestamp DESC
        LIMIT ?
      ) ORDER BY timestamp
    `;

    const rows = this.db
      .prepare(sql)
      .all(lastTimestamp, ...jids, `${botPrefix}:%`, limit) as NewMessage[];

    let newTimestamp = lastTimestamp;
    for (const row of rows) {
      if (row.timestamp > newTimestamp) newTimestamp = row.timestamp;
    }

    return { messages: rows, newTimestamp };
  }

  getSince(
    chatJid: string,
    sinceTimestamp: string,
    botPrefix: string,
    limit: number = 200,
  ): NewMessage[] {
    const sql = `
      SELECT * FROM (
        SELECT id, chat_jid, sender, sender_name, content, timestamp, is_from_me
        FROM messages
        WHERE chat_jid = ? AND timestamp > ?
          AND is_bot_message = 0 AND content NOT LIKE ?
          AND content != '' AND content IS NOT NULL
        ORDER BY timestamp DESC
        LIMIT ?
      ) ORDER BY timestamp
    `;
    return this.db
      .prepare(sql)
      .all(chatJid, sinceTimestamp, `${botPrefix}:%`, limit) as NewMessage[];
  }
}
