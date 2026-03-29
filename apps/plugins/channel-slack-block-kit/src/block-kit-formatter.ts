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
  const color = getToolColor(toolName);
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
export function formatToBlockKit(text: string): KnownBlock[] | null {
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

export { getToolColor };
