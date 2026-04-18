#!/usr/bin/env node
// List all registered groups for an assistant.
// Usage:  node list.mjs <assistantName>
// Output: JSON { ok: boolean, groups: {jid, name, channel, folder, trigger, isMain, requiresTrigger}[], reason? }

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const [, , assistant] = process.argv;
if (!assistant) {
  console.log(JSON.stringify({ ok: false, reason: "usage: <assistantName>" }));
  process.exit(2);
}

const dbPath = path.resolve(process.cwd(), `__data/${assistant}/store/nagi.db`);
if (!fs.existsSync(dbPath)) {
  console.log(JSON.stringify({ ok: false, reason: `DB not found: ${dbPath}` }));
  process.exit(0);
}

const { createDatabase } = require(path.resolve(process.cwd(), "libs/db/dist/index.js"));
const db = createDatabase({ path: dbPath });
const all = db.groups.getAll();
db.close();

const groups = Object.entries(all).map(([jid, g]) => ({
  jid,
  name: g.name,
  channel: g.channel,
  folder: g.folder,
  trigger: g.trigger,
  isMain: !!g.isMain,
  requiresTrigger: g.requiresTrigger !== false,
}));

console.log(JSON.stringify({ ok: true, groups }));
