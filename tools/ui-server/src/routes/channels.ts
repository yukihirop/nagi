import type { NagiDatabase } from "@nagi/db";

export function handleChannels(db: NagiDatabase) {
  return db.chats.getAll();
}
