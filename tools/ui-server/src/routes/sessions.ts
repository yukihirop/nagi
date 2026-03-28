import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

export interface SessionInfo {
  groupFolder: string;
  sessionId: string;
  startedAt: number;
  messageCount: number;
}

export interface ChatMessage {
  type: "user" | "assistant";
  content: string;
  timestamp: string;
  uuid: string;
  toolUses?: Array<{ name: string; input: Record<string, unknown> }>;
  thinking?: string;
}

function findSessionsDir(dataDir: string): string {
  return path.join(dataDir, "sessions");
}

export function handleSessions(dataDir: string): SessionInfo[] {
  const sessionsDir = findSessionsDir(dataDir);
  if (!fs.existsSync(sessionsDir)) return [];

  const sessions: SessionInfo[] = [];

  const groupFolders = fs.readdirSync(sessionsDir).filter((f) => {
    try {
      return fs.statSync(path.join(sessionsDir, f)).isDirectory();
    } catch {
      return false;
    }
  });

  for (const groupFolder of groupFolders) {
    const metaDir = path.join(sessionsDir, groupFolder, ".claude", "sessions");
    if (!fs.existsSync(metaDir)) continue;

    const metaFiles = fs.readdirSync(metaDir).filter((f) => f.endsWith(".json"));
    for (const metaFile of metaFiles) {
      try {
        const raw = fs.readFileSync(path.join(metaDir, metaFile), "utf-8");
        const meta = JSON.parse(raw) as { sessionId?: string; startedAt?: number };
        if (meta.sessionId) {
          const jsonlPath = path.join(
            sessionsDir, groupFolder, ".claude", "projects", "-workspace-group", `${meta.sessionId}.jsonl`,
          );
          let messageCount = 0;
          try {
            if (fs.existsSync(jsonlPath)) {
              const content = fs.readFileSync(jsonlPath, "utf-8");
              for (const line of content.split("\n")) {
                if (!line.trim()) continue;
                try {
                  const entry = JSON.parse(line) as { type?: string; message?: { content?: unknown } };
                  if (entry.type === "user") {
                    // Skip tool_result user entries
                    if (!Array.isArray(entry.message?.content)) messageCount++;
                  } else if (entry.type === "assistant") {
                    const c = entry.message?.content;
                    if (Array.isArray(c) && c.some((b: { type?: string }) => b.type === "text")) messageCount++;
                  }
                } catch { /* skip */ }
              }
            }
          } catch { /* skip */ }
          sessions.push({
            groupFolder,
            sessionId: meta.sessionId,
            startedAt: meta.startedAt ?? 0,
            messageCount,
          });
        }
      } catch {
        // skip invalid files
      }
    }
  }

  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

function extractUserText(content: unknown): string | null {
  // tool_result messages have array content — skip them
  if (Array.isArray(content)) return null;
  if (typeof content !== "string") return null;

  const messages: string[] = [];
  const re = /<message[^>]*>([^<]*)<\/message>/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    if (match[1].trim()) {
      messages.push(match[1].trim());
    }
  }
  return messages.length > 0 ? messages.join("\n") : null;
}

interface AssistantExtract {
  text: string;
  toolUses: Array<{ name: string; input: Record<string, unknown> }>;
  thinking: string;
}

function extractAssistantContent(content: unknown): AssistantExtract {
  const toolUses: Array<{ name: string; input: Record<string, unknown> }> = [];
  const texts: string[] = [];
  const thinkings: string[] = [];

  if (typeof content === "string") {
    return { text: content, toolUses, thinking: "" };
  }

  if (!Array.isArray(content)) {
    return { text: "", toolUses, thinking: "" };
  }

  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as Record<string, unknown>;
    if (b.type === "text" && typeof b.text === "string") {
      texts.push(b.text);
    } else if (b.type === "tool_use" && typeof b.name === "string") {
      toolUses.push({
        name: b.name,
        input: (typeof b.input === "object" && b.input !== null ? b.input : {}) as Record<string, unknown>,
      });
    } else if (b.type === "thinking" && typeof b.thinking === "string") {
      thinkings.push(b.thinking);
    }
  }

  return { text: texts.join("\n"), toolUses, thinking: thinkings.join("\n") };
}

export async function handleSessionMessages(
  dataDir: string,
  sessionId: string,
): Promise<ChatMessage[]> {
  const sessionsDir = findSessionsDir(dataDir);
  if (!fs.existsSync(sessionsDir)) return [];

  let jsonlPath: string | null = null;
  const groupFolders = fs.readdirSync(sessionsDir).filter((f) => {
    try {
      return fs.statSync(path.join(sessionsDir, f)).isDirectory();
    } catch {
      return false;
    }
  });

  for (const groupFolder of groupFolders) {
    const candidate = path.join(
      sessionsDir,
      groupFolder,
      ".claude",
      "projects",
      "-workspace-group",
      `${sessionId}.jsonl`,
    );
    if (fs.existsSync(candidate)) {
      jsonlPath = candidate;
      break;
    }
  }

  if (!jsonlPath) return [];

  // Parse all raw entries first
  type RawEntry = {
    type: string;
    uuid: string;
    parentUuid: string | null;
    timestamp: string;
    message?: Record<string, unknown>;
  };

  const rawEntries: RawEntry[] = [];
  const stream = fs.createReadStream(jsonlPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      const type = entry.type as string;
      if (type === "user" || type === "assistant") {
        rawEntries.push({
          type,
          uuid: (entry.uuid as string) ?? "",
          parentUuid: (entry.parentUuid as string) ?? null,
          timestamp: (entry.timestamp as string) ?? "",
          message: entry.message as Record<string, unknown> | undefined,
        });
      }
    } catch {
      // skip
    }
  }

  // Merge consecutive assistant messages into turns
  const messages: ChatMessage[] = [];
  let pendingAssistant: {
    texts: string[];
    toolUses: Array<{ name: string; input: Record<string, unknown> }>;
    thinkings: string[];
    timestamp: string;
    uuid: string;
  } | null = null;

  function flushAssistant() {
    if (!pendingAssistant) return;
    const { texts, toolUses, thinkings, timestamp, uuid } = pendingAssistant;
    const text = texts.join("\n");
    const thinking = thinkings.join("\n");

    // Skip if nothing meaningful
    if (!text && toolUses.length === 0) {
      pendingAssistant = null;
      return;
    }

    messages.push({
      type: "assistant",
      content: text,
      timestamp,
      uuid,
      ...(toolUses.length > 0 ? { toolUses } : {}),
      ...(thinking ? { thinking } : {}),
    });
    pendingAssistant = null;
  }

  for (const entry of rawEntries) {
    if (entry.type === "user") {
      flushAssistant();
      const text = extractUserText(entry.message?.content);
      if (text) {
        messages.push({
          type: "user",
          content: text,
          timestamp: entry.timestamp,
          uuid: entry.uuid,
        });
      }
    } else if (entry.type === "assistant") {
      const { text, toolUses, thinking } = extractAssistantContent(entry.message?.content);

      if (!pendingAssistant) {
        pendingAssistant = {
          texts: text ? [text] : [],
          toolUses: [...toolUses],
          thinkings: thinking ? [thinking] : [],
          timestamp: entry.timestamp,
          uuid: entry.uuid,
        };
      } else {
        // Merge into pending
        if (text) pendingAssistant.texts.push(text);
        pendingAssistant.toolUses.push(...toolUses);
        if (thinking) pendingAssistant.thinkings.push(thinking);
      }
    }
  }
  flushAssistant();

  return messages;
}
