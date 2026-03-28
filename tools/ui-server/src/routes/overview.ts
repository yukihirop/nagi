import type { NagiDatabase } from "@nagi/db";

export function handleOverview(db: NagiDatabase) {
  const groups = db.groups.getAll();
  const chats = db.chats.getAll();
  const tasks = db.tasks.getAll();

  return {
    groups: Object.keys(groups).length,
    channels: chats.length,
    tasks: tasks.length,
    activeTasks: tasks.filter((t) => t.status === "active").length,
  };
}
