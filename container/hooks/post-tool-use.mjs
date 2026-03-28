import { writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const MESSAGES_DIR = "/workspace/ipc/messages";
const CHAT_JID = process.env.NAGI_CHAT_JID || "";
const GROUP_FOLDER = process.env.NAGI_GROUP_FOLDER || "main";

// Skip tools that would cause infinite loops or noise
const SKIP_TOOLS = new Set([
  "mcp__nagi__send_message",
  "mcp__nagi__list_tasks",
]);

const ICONS = {
  Bash: "\u{1F527}",
  Read: "\u{1F4D6}",
  Write: "\u{1F4DD}",
  Edit: "\u{270F}\uFE0F",
  Glob: "\u{1F4C2}",
  Grep: "\u{1F50D}",
  Skill: "\u{26A1}",
  Agent: "\u{1F916}",
  WebSearch: "\u{1F310}",
  WebFetch: "\u{1F310}",
  Task: "\u{23F0}",
  TaskOutput: "\u{1F4E4}",
  TaskStop: "\u{23F9}\uFE0F",
  TodoWrite: "\u{1F4CB}",
  ToolSearch: "\u{1F50D}",
  NotebookEdit: "\u{1F4D3}",
};

function getIcon(name) {
  if (name.startsWith("mcp__")) return "\u{1F50C}";
  return ICONS[name] || "\u{2699}\uFE0F";
}

function getSummary(name, input) {
  switch (name) {
    case "Read":
    case "Write":
    case "Glob":
      return input.file_path || input.pattern || "";
    case "Edit":
      return input.file_path || "";
    case "Grep":
      return input.pattern || "";
    case "Bash": {
      const cmd = input.command || "";
      return cmd.length > 80 ? cmd.slice(0, 80) + "..." : cmd;
    }
    case "Skill":
      return input.skill || "";
    case "Agent":
      return input.description || "";
    case "WebSearch":
      return input.query || "";
    case "WebFetch":
      return input.url || "";
    default:
      for (const key of ["file_path", "path", "command", "query", "name", "url"]) {
        if (typeof input[key] === "string") return input[key];
      }
      return "";
  }
}

function writeIpcMessage(text) {
  mkdirSync(MESSAGES_DIR, { recursive: true });
  const id = randomUUID().slice(0, 8);
  const timestamp = new Date().toISOString();
  const filename = `${timestamp.replace(/[:.]/g, "-")}-${id}.json`;
  const data = JSON.stringify({
    type: "message",
    chatJid: CHAT_JID,
    text,
    groupFolder: GROUP_FOLDER,
    timestamp,
  });
  const tmpPath = join(MESSAGES_DIR, `.tmp-${filename}`);
  const finalPath = join(MESSAGES_DIR, filename);
  writeFileSync(tmpPath, data);
  renameSync(tmpPath, finalPath);
}

// Main
const toolName = process.env.CLAUDE_TOOL_USE_NAME;
if (!toolName || SKIP_TOOLS.has(toolName) || !CHAT_JID) {
  process.exit(0);
}

let input = {};
try {
  input = JSON.parse(process.env.CLAUDE_TOOL_USE_INPUT || "{}");
} catch {
  // ignore
}

const icon = getIcon(toolName);
const summary = getSummary(toolName, input);
const text = summary ? `${icon} ${toolName}: ${summary}` : `${icon} ${toolName}`;

writeIpcMessage(text);
