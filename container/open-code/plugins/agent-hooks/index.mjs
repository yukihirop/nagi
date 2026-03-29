// IMPORTANT: This file is intentionally duplicated per agent (claude-code / open-code).
// Each agent's hooks may diverge independently — sharing with conditional branches
// tends to cause subtle bugs. Keep copies in sync manually where applicable.
import fs from "node:fs";
import path from "node:path";

const MESSAGES_DIR = "/workspace/ipc/messages";

const TOOL_ICONS = {
  Bash: "\u{1F527}", Read: "\u{1F4D6}", Write: "\u{1F4DD}", Edit: "\u{270F}\uFE0F",
  Glob: "\u{1F4C2}", Grep: "\u{1F50D}", Skill: "\u{26A1}", Agent: "\u{1F916}",
  WebSearch: "\u{1F310}", WebFetch: "\u{1F310}", Task: "\u{23F0}",
  TaskOutput: "\u{1F4E4}", TaskStop: "\u{23F9}\uFE0F", TodoWrite: "\u{1F4CB}",
};

const DEFAULT_SKIP_TOOLS = ["mcp__nagi__send_message", "mcp__nagi__list_tasks"];

function writeIpcMessage(chatJid, groupFolder, text) {
  fs.mkdirSync(MESSAGES_DIR, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`;
  const filepath = path.join(MESSAGES_DIR, filename);
  const tempPath = `${filepath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify({
    type: "message",
    chatJid,
    text,
    groupFolder,
    timestamp: new Date().toISOString(),
  }));
  fs.renameSync(tempPath, filepath);
}

function toolSummary(name, input) {
  switch (name) {
    case "Read": case "Write": case "Glob":
      return input.file_path ?? input.pattern ?? "";
    case "Edit":
      return input.file_path ?? "";
    case "Grep":
      return input.pattern ?? "";
    case "Bash": {
      const cmd = input.command ?? "";
      return cmd.length > 80 ? cmd.slice(0, 80) + "..." : cmd;
    }
    case "Skill": return input.skill ?? "";
    case "Agent": return input.description ?? "";
    case "WebSearch": return input.query ?? "";
    case "WebFetch": return input.url ?? "";
    default:
      for (const key of ["file_path", "path", "command", "query", "name", "url"]) {
        if (typeof input[key] === "string") return input[key];
      }
      return "";
  }
}

export function createPostToolUseHook(chatJid, groupFolder, extraSkipTools, log) {
  const skipTools = new Set([...DEFAULT_SKIP_TOOLS, ...(extraSkipTools ?? [])]);
  return async (input) => {
    try {
      const name = input.tool_name;
      log(`[hook:PostToolUse] tool=${name} chatJid=${chatJid}`);
      if (!name || !chatJid || skipTools.has(name)) return {};
      const icon = name.startsWith("mcp__") ? "\u{1F50C}" : (TOOL_ICONS[name] ?? "\u{2699}\uFE0F");
      const summary = toolSummary(name, input.tool_input ?? {});
      const text = summary ? `${icon} \`${name}: ${summary}\`` : `${icon} \`${name}\``;
      writeIpcMessage(chatJid, groupFolder, text);
      log(`[hook:PostToolUse] sent: ${text}`);
    } catch (err) {
      log(`[hook:PostToolUse] error: ${err}`);
    }
    return {};
  };
}

export function createPromptCompleteHook(chatJid, groupFolder, log) {
  return async (input) => {
    try {
      if (!chatJid) return {};
      const model = input?.model ?? "";
      const cost = input?.cost;
      let text;
      if (cost && (cost.cost > 0 || cost.tokens?.input > 0)) {
        const costStr = cost.cost > 0 ? `$${cost.cost.toFixed(4)}` : "N/A";
        const tokensIn = (cost.tokens?.input ?? 0).toLocaleString();
        const tokensOut = (cost.tokens?.output ?? 0).toLocaleString();
        text = `\u{1F4B0} \`${model} | ${costStr} | ${tokensIn} in / ${tokensOut} out\``;
      } else if (model) {
        text = `\u{1F4B0} \`${model}\``;
      } else {
        return {};
      }
      writeIpcMessage(chatJid, groupFolder, text);
      log(`[hook:PromptComplete] sent: ${text}`);
    } catch (err) {
      log(`[hook:PromptComplete] error: ${err}`);
    }
    return {};
  };
}

export function createSessionStartHook(chatJid, groupFolder, log) {
  return async (input) => {
    try {
      log(`[hook:SessionStart] chatJid=${chatJid} source=${input?.source}`);
      if (!chatJid) return {};
      const thinking = input?.thinking ?? "";
      const text = thinking
        ? `\u{1F4AD} \`Thinking: ${thinking.length > 200 ? thinking.slice(0, 200) + "..." : thinking}\``
        : "\u{1F4AD} Thinking...";
      writeIpcMessage(chatJid, groupFolder, text);
      log(`[hook:SessionStart] sent: ${text}`);
    } catch (err) {
      log(`[hook:SessionStart] error: ${err}`);
    }
    return {};
  };
}
