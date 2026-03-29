import { EmbedBuilder } from "discord.js";

const TOOL_NOTIFICATION_PATTERN = /^(.+?)\s`([^:]+?)(?::\s(.+?))?`$/;
const THINKING_PATTERN = /^💭\s*Thinking\.\.\.$/;

const TOOL_COLORS: Record<string, number> = {
  Bash: 0x4a9fff,
  Read: 0x50c878,
  Write: 0xe2725b,
  Edit: 0xffb347,
  Glob: 0x87ceeb,
  Grep: 0xdda0dd,
  Agent: 0x9b59b6,
  Skill: 0xf39c12,
  WebSearch: 0x3498db,
  WebFetch: 0x3498db,
};

function getToolColor(toolName: string): number {
  if (toolName.startsWith("mcp__")) return 0x8e44ad;
  return TOOL_COLORS[toolName] ?? 0x95a5a6;
}

/**
 * Convert tool notification text to Discord Embed.
 * Returns null if text doesn't match a known pattern.
 */
export function formatToolNotification(text: string): EmbedBuilder[] | null {
  if (THINKING_PATTERN.test(text)) {
    return [
      new EmbedBuilder()
        .setColor(0x95a5a6)
        .setDescription("💭 _Thinking..._"),
    ];
  }

  const match = text.match(TOOL_NOTIFICATION_PATTERN);
  if (match) {
    const [, icon, toolName, detail] = match;
    const displayName = toolName.startsWith("mcp__")
      ? toolName.replace(/^mcp__/, "").replace(/__/g, " > ")
      : toolName;

    const embed = new EmbedBuilder()
      .setColor(getToolColor(toolName))
      .setTitle(`${icon} ${displayName}`);

    if (detail) {
      embed.setDescription(`\`${detail}\``);
    }

    return [embed];
  }

  return null;
}

/**
 * Detect if a line is part of a markdown table.
 */
function isTableLine(line: string): boolean {
  return /^\s*\|/.test(line);
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|[\s-:|]+\|/.test(line) && !/[a-zA-Z0-9\u3000-\u9FFF]/.test(line);
}

function formatTable(lines: string[]): string {
  const dataLines = lines.filter((l) => !isTableSeparator(l));
  const rows = dataLines.map((line) =>
    line.split("|").slice(1, -1).map((cell) => cell.trim().replace(/\*\*/g, "")),
  );
  if (rows.length === 0) return "";

  const colCount = Math.max(...rows.map((r) => r.length));
  const widths: number[] = [];
  for (let col = 0; col < colCount; col++) {
    widths.push(Math.max(...rows.map((r) => (r[col] ?? "").length), 0));
  }

  return rows
    .map((row) => row.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join("  "))
    .join("\n");
}

const EMBED_DESC_LIMIT = 4096;

/**
 * Convert a full markdown message to Discord Embeds.
 * Discord supports markdown natively, so we mainly split by headers/dividers
 * and render tables as code blocks.
 */
export function formatMarkdownToEmbeds(text: string): EmbedBuilder[] {
  const lines = text.split("\n");
  const embeds: EmbedBuilder[] = [];
  let currentTitle: string | null = null;
  let currentLines: string[] = [];
  let tableBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      const formatted = formatTable(tableBuffer);
      if (formatted) {
        currentLines.push("```", formatted, "```");
      }
      tableBuffer = [];
    }
  };

  const flushEmbed = () => {
    flushTable();
    const desc = currentLines.join("\n").trim();
    if (desc || currentTitle) {
      const embed = new EmbedBuilder().setColor(0x5865f2);
      if (currentTitle) embed.setTitle(currentTitle);
      if (desc) embed.setDescription(desc.slice(0, EMBED_DESC_LIMIT));
      embeds.push(embed);
    }
    currentTitle = null;
    currentLines = [];
  };

  for (const line of lines) {
    // Horizontal rule → new embed
    if (/^\s*---+\s*$/.test(line)) {
      flushEmbed();
      continue;
    }

    // Header → new embed with title
    const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headerMatch) {
      flushEmbed();
      currentTitle = headerMatch[1].slice(0, 256);
      continue;
    }

    // Table lines
    if (isTableLine(line)) {
      if (tableBuffer.length === 0) flushTable();
      tableBuffer.push(line);
      continue;
    }

    if (tableBuffer.length > 0) {
      flushTable();
    }

    currentLines.push(line);
  }

  flushEmbed();

  if (embeds.length === 0) {
    embeds.push(
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setDescription(text.slice(0, EMBED_DESC_LIMIT) || " "),
    );
  }

  return embeds;
}

export { getToolColor };
