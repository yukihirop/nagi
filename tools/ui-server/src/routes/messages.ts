import type { NagiDatabase } from "@nagi/db";

export function handleMessages(
  db: NagiDatabase,
  chatJid: string | null,
  since: string | null,
) {
  if (!chatJid) {
    return { error: "chatJid query parameter is required" };
  }
  const sinceTs = since ?? "1970-01-01T00:00:00.000Z";
  return db.messages.getSince(chatJid, sinceTs, "", 100);
}
