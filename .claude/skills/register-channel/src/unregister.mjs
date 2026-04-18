#!/usr/bin/env node
// Delete a group from the assistant's DB.
// Usage:  node unregister.mjs <assistantName> <jid>
// Output: JSON { ok: boolean, jid?, deleted?, reason? }
// Note:   does NOT remove the __data/.../groups/{channel}/{folder}/ dir —
//         group prompts may still be useful if the group is re-registered later.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const [, , assistant, jid] = process.argv;
if (!assistant || !jid) {
  console.log(JSON.stringify({ ok: false, reason: "usage: <assistantName> <jid>" }));
  process.exit(2);
}

const dbPath = path.resolve(process.cwd(), `__data/${assistant}/store/nagi.db`);
if (!fs.existsSync(dbPath)) {
  console.log(JSON.stringify({ ok: false, reason: `DB not found: ${dbPath}` }));
  process.exit(0);
}

const { createDatabase } = require(path.resolve(process.cwd(), "libs/db/dist/index.js"));
const db = createDatabase({ path: dbPath });
const existing = db.groups.get(jid);
if (!existing) {
  db.close();
  console.log(JSON.stringify({ ok: false, jid, reason: "not found" }));
  process.exit(0);
}

// GroupRepository doesn't expose a delete method, so drop to the raw
// better-sqlite3 escape hatch (`db.raw`, per libs/db/src/database.ts).
db.raw.prepare("DELETE FROM registered_groups WHERE jid = ?").run(jid);
db.close();

console.log(JSON.stringify({ ok: true, jid, deleted: true }));
