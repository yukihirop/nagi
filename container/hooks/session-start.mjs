import { writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const MESSAGES_DIR = "/workspace/ipc/messages";
const CHAT_JID = process.env.NAGI_CHAT_JID || "";
const GROUP_FOLDER = process.env.NAGI_GROUP_FOLDER || "main";

if (!CHAT_JID) process.exit(0);

const timestamp = new Date().toISOString();
const id = randomUUID().slice(0, 8);
const filename = `${timestamp.replace(/[:.]/g, "-")}-${id}.json`;

mkdirSync(MESSAGES_DIR, { recursive: true });

const data = JSON.stringify({
  type: "message",
  chatJid: CHAT_JID,
  text: "\u{1F4AD} Thinking...",
  groupFolder: GROUP_FOLDER,
  timestamp,
});

const tmpPath = join(MESSAGES_DIR, `.tmp-${filename}`);
const finalPath = join(MESSAGES_DIR, filename);
writeFileSync(tmpPath, data);
renameSync(tmpPath, finalPath);
