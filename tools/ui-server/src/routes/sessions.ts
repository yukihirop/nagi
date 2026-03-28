import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

export interface SessionInfo {
  groupFolder: string;
  sessionId: string;
  startedAt: number;
}

export interface ChatMessage {
  type: "user" | "assistant";
  content: string;
  timestamp: string;
  uuid: string;
  toolUses?: Array<{ name: string }>;
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
          sessions.push({
            groupFolder,
            sessionId: meta.sessionId,
            startedAt: meta.startedAt ?? 0,
          });
        }
      } catch {
        // skip invalid files
      }
    }
  }

  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

function extractUserText(content: unknown): string {
  if (typeof content !== "string") return "";
  // Extract text from <message ...>text</message> tags
  const messages: string[] = [];
  const re = /<message[^>]*>([^<]*)<\/message>/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    if (match[1].trim()) {
      messages.push(match[1].trim());
    }
  }
  return messages.join("\n") || content;
}

function extractAssistantContent(content: unknown): { text: string; toolUses: Array<{ name: string }> } {
  const toolUses: Array<{ name: string }> = [];
  const texts: string[] = [];

  if (typeof content === "string") {
    return { text: content, toolUses };
  }

  if (!Array.isArray(content)) {
    return { text: "", toolUses };
  }

  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as Record<string, unknown>;
    if (b.type === "text" && typeof b.text === "string") {
      texts.push(b.text);
    } else if (b.type === "tool_use" && typeof b.name === "string") {
      toolUses.push({ name: b.name });
    }
  }

  return { text: texts.join("\n"), toolUses };
}

export async function handleSessionMessages(
  dataDir: string,
  sessionId: string,
): Promise<ChatMessage[]> {
  const sessionsDir = findSessionsDir(dataDir);
  if (!fs.existsSync(sessionsDir)) return [];

  // Find the JSONL file across all group folders
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

  const messages: ChatMessage[] = [];
  const stream = fs.createReadStream(jsonlPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      const type = entry.type as string;

      if (type === "user") {
        const msg = entry.message as Record<string, unknown> | undefined;
        const text = extractUserText(msg?.content);
        if (text) {
          messages.push({
            type: "user",
            content: text,
            timestamp: (entry.timestamp as string) ?? "",
            uuid: (entry.uuid as string) ?? "",
          });
        }
      } else if (type === "assistant") {
        const msg = entry.message as Record<string, unknown> | undefined;
        const { text, toolUses } = extractAssistantContent(msg?.content);
        if (text || toolUses.length > 0) {
          messages.push({
            type: "assistant",
            content: text,
            timestamp: (entry.timestamp as string) ?? "",
            uuid: (entry.uuid as string) ?? "",
            ...(toolUses.length > 0 ? { toolUses } : {}),
          });
        }
      }
      // skip queue-operation and other types
    } catch {
      // skip invalid lines
    }
  }

  return messages;
}
