import type { KnownBlock } from "@slack/types";

/**
 * Pattern: emoji followed by backtick-wrapped tool info
 * Examples:
 *   🔧 `Bash: ls -la /workspace`
 *   📖 `Read: src/index.ts`
 *   🔍 `Grep: TODO`
 *   🔌 `mcp__ollama__generate: ...`
 */
const TOOL_NOTIFICATION_PATTERN = /^(.+?)\s`([^:]+?)(?::\s(.+?))?`$/;

const THINKING_PATTERN = /^💭\s*Thinking\.\.\.$/;

const TOOL_COLORS: Record<string, string> = {
  Bash: "#4A9FFF",
  Read: "#50C878",
  Write: "#E2725B",
  Edit: "#FFB347",
  Glob: "#87CEEB",
  Grep: "#DDA0DD",
  Agent: "#9B59B6",
  Skill: "#F39C12",
  WebSearch: "#3498DB",
  WebFetch: "#3498DB",
};

function getToolColor(toolName: string): string {
  if (toolName.startsWith("mcp__")) return "#8E44AD";
  return TOOL_COLORS[toolName] ?? "#95A5A6";
}

function formatThinkingBlocks(): KnownBlock[] {
  return [
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "💭 _Thinking..._",
        },
      ],
    },
  ];
}

function formatToolBlocks(
  icon: string,
  toolName: string,
  detail: string | undefined,
): KnownBlock[] {
  const displayName = toolName.startsWith("mcp__")
    ? toolName.replace(/^mcp__/, "").replace(/__/g, " › ")
    : toolName;

  const blocks: KnownBlock[] = [
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${icon} *${displayName}*`,
        },
      ],
    },
  ];

  if (detail) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`${detail}\``,
      },
    });
  }

  blocks.push({
    type: "divider",
  });

  return blocks;
}

/**
 * Convert tool notification text to Slack Block Kit blocks.
 * Returns null if the text doesn't match any known pattern (pass through as plain text).
 */
export function formatToolNotification(text: string): KnownBlock[] | null {
  if (THINKING_PATTERN.test(text)) {
    return formatThinkingBlocks();
  }

  const match = text.match(TOOL_NOTIFICATION_PATTERN);
  if (match) {
    const [, icon, toolName, detail] = match;
    return formatToolBlocks(icon, toolName, detail);
  }

  return null;
}

// --- Markdown to Block Kit conversion ---

/**
 * Convert markdown syntax to Slack mrkdwn syntax.
 * Handles: **bold** → *bold*, [text](url) → <url|text>, inline code (preserved)
 */
function markdownToMrkdwn(text: string): string {
  let result = text;

  // Convert markdown links [text](url) → <url|text>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");

  // Convert **bold** → *bold* (Slack uses single asterisk)
  // Be careful not to touch single * (already italic in some contexts)
  result = result.replace(/\*\*(.+?)\*\*/g, "*$1*");

  return result;
}

/**
 * Detect if a line is part of a markdown table.
 */
function isTableLine(line: string): boolean {
  return /^\s*\|/.test(line);
}

/**
 * Detect if a line is a table separator (|---|---|).
 */
function isTableSeparator(line: string): boolean {
  return /^\s*\|[\s-:|]+\|/.test(line) && !/[a-zA-Z0-9\u3000-\u9FFF]/.test(line);
}

/**
 * Format markdown table lines into a code block for readable display.
 * Slack doesn't support tables, so we use a preformatted block.
 */
function formatTable(lines: string[]): string {
  // Filter out separator lines and extract data
  const dataLines = lines.filter((l) => !isTableSeparator(l));

  // Parse cells
  const rows = dataLines.map((line) =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/\*\*/g, "")),
  );

  if (rows.length === 0) return "";

  // Calculate column widths
  const colCount = Math.max(...rows.map((r) => r.length));
  const widths: number[] = [];
  for (let col = 0; col < colCount; col++) {
    widths.push(
      Math.max(...rows.map((r) => (r[col] ?? "").length), 0),
    );
  }

  // Format with padding
  const formatted = rows.map((row) =>
    row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join("  "),
  );

  return formatted.join("\n");
}

/**
 * Convert a full markdown message to Slack Block Kit blocks.
 * Splits by headers and dividers, converts syntax within sections.
 */
export function formatMarkdownToBlockKit(text: string): KnownBlock[] {
  const lines = text.split("\n");
  const blocks: KnownBlock[] = [];
  let currentText: string[] = [];
  let tableBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      const formatted = formatTable(tableBuffer);
      if (formatted) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: "```\n" + formatted + "\n```",
          },
        });
      }
      tableBuffer = [];
    }
  };

  const flushText = () => {
    flushTable();
    if (currentText.length > 0) {
      const joined = currentText.join("\n").trim();
      if (joined) {
        // Slack Block Kit has a 3000 char limit per text field
        const chunks = splitText(markdownToMrkdwn(joined), 3000);
        for (const chunk of chunks) {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: chunk,
            },
          });
        }
      }
      currentText = [];
    }
  };

  for (const line of lines) {
    // Horizontal rule → divider
    if (/^\s*---+\s*$/.test(line)) {
      flushText();
      blocks.push({ type: "divider" });
      continue;
    }

    // Header → header block (max 150 chars)
    const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headerMatch) {
      flushText();
      const headerText = headerMatch[1].replace(/\*\*/g, "").slice(0, 150);
      blocks.push({
        type: "header",
        text: {
          type: "plain_text",
          text: headerText,
          emoji: true,
        },
      });
      continue;
    }

    // Table lines → buffer
    if (isTableLine(line)) {
      if (tableBuffer.length === 0) {
        // Starting a new table, flush any pending text
        if (currentText.length > 0) {
          const joined = currentText.join("\n").trim();
          if (joined) {
            const chunks = splitText(markdownToMrkdwn(joined), 3000);
            for (const chunk of chunks) {
              blocks.push({
                type: "section",
                text: { type: "mrkdwn", text: chunk },
              });
            }
          }
          currentText = [];
        }
      }
      tableBuffer.push(line);
      continue;
    }

    // Non-table line after table → flush table
    if (tableBuffer.length > 0) {
      flushTable();
    }

    // Regular line
    currentText.push(line);
  }

  flushText();

  // Block Kit requires at least one block
  if (blocks.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: markdownToMrkdwn(text) || " " },
    });
  }

  return blocks;
}

function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Try to split at a newline
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt <= 0) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt + 1);
  }
  return chunks;
}

export { getToolColor };
