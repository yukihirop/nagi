import type { NagiDatabase } from "@nagi/db";

export function handleGroups(db: NagiDatabase) {
  return db.groups.getAll();
}
