#!/usr/bin/env node
// Register a group in the assistant's DB and create its prompt folder.
// Usage:
//   node register.mjs --assistant tom --channel slack --id C0AP0BRN50X \
//     --name Main --folder main --trigger "@tom" --isMain true --requiresTrigger false
// Output: JSON { ok: boolean, jid?, created?, overwrote?, reason? }

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { buildJid, validateFolder, validateId } from "./jid.mjs";

const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    args[key] = argv[i + 1];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const required = ["assistant", "channel", "id", "name", "folder", "trigger", "isMain", "requiresTrigger"];
for (const k of required) {
  if (args[k] === undefined) {
    console.log(JSON.stringify({ ok: false, reason: `missing --${k}` }));
    process.exit(2);
  }
}

const { assistant, channel, id } = args;
const groupName = args.name;
const folder = args.folder;
const trigger = args.trigger;
const isMain = args.isMain === "true";
const requiresTrigger = args.requiresTrigger === "true";

if (!validateId(channel, id)) {
  // Soft-warn — caller asked with whatever they had. Still proceed.
}
if (!validateFolder(folder)) {
  console.log(JSON.stringify({ ok: false, reason: `invalid folder: ${folder}` }));
  process.exit(0);
}

const jid = buildJid(channel, id);
const dbPath = path.resolve(process.cwd(), `__data/${assistant}/store/messages.db`);
if (!fs.existsSync(dbPath)) {
  console.log(JSON.stringify({ ok: false, reason: `DB not found: ${dbPath}` }));
  process.exit(0);
}

const { createDatabase } = require(path.resolve(process.cwd(), "libs/db/dist/index.js"));
const db = createDatabase({ path: dbPath });

const existing = db.groups.get(jid);
db.groups.set(jid, {
  name: groupName,
  channel,
  folder,
  trigger,
  added_at: new Date().toISOString(),
  isMain,
  requiresTrigger,
});
db.close();

const folderPath = path.resolve(process.cwd(), `__data/${assistant}/groups/${channel}/${folder}`);
const folderCreated = !fs.existsSync(folderPath);
fs.mkdirSync(folderPath, { recursive: true });

console.log(
  JSON.stringify({
    ok: true,
    jid,
    overwrote: !!existing,
    folderCreated,
    folderPath: path.relative(process.cwd(), folderPath),
  }),
);
