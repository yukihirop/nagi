import type { MessageAttachment } from "@slack/types";
import { getToolColor } from "@nagi/channel-slack-block-kit";

/**
 * Pattern: emoji followed by backtick-wrapped tool info.
 * Kept in sync with channel-slack-block-kit's block-kit-formatter.ts.
 */
const TOOL_NOTIFICATION_PATTERN = /^(.+?)\s`([^:]+?)(?::\s(.+?))?`$/;
const THINKING_PATTERN = /^💭\s*Thinking\.\.\.$/;
const COST_PREFIX = "💰";

/** Discord blurple — matches channel-discord-embed default reply color. */
const DEFAULT_REPLY_COLOR = "#5865F2";
/** Discord Embed default gray — used for thinking & cost footer attachments. */
const DEFAULT_INFO_COLOR = "#95A5A6";

/**
 * Convert a subset of markdown syntax to Slack mrkdwn.
 *
 * Slack mrkdwn does not support headers, so we render them as bold lines.
 * We intentionally keep this minimal — complex markdown (tables, nested
 * lists, etc.) will degrade gracefully but may not render perfectly.
 */
function markdownToMrkdwn(text: string): string {
  let result = text;
  // Headers (# .. ######) → bold (mrkdwn has no header syntax)
  result = result.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");
  // Horizontal rules → a visually similar separator line
  result = result.replace(/^\s*---+\s*$/gm, "───");
  // Markdown links [label](url) → <url|label>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");
  // **bold** → *bold* (mrkdwn uses a single asterisk)
  result = result.replace(/\*\*(.+?)\*\*/g, "*$1*");
  return result;
}

/**
 * Build a Slack legacy-style attachment for the given outbound message.
 *
 * Using legacy attachment fields (`color`, `title`, `text`, `fallback`)
 * instead of `attachments[].blocks` has two upsides:
 *
 * 1. Slack renders a colored left-border bar (same as Discord Embed).
 * 2. Slack's new UI does NOT add the "Posted by: <app>" attribution line,
 *    which it does attach to every attachment containing `blocks`.
 *
 * Mrkdwn parsing inside `title` and `text` is enabled via `mrkdwn_in`.
 */
export function formatEmbedAttachment(text: string): MessageAttachment {
  // --- Thinking indicator ---
  if (THINKING_PATTERN.test(text)) {
    return {
      color: DEFAULT_INFO_COLOR,
      text: "💭 _Thinking..._",
      fallback: "Thinking...",
      mrkdwn_in: ["text"],
    };
  }

  // --- Cost footer & tool notifications (single-line backtick pattern) ---
  const match = text.match(TOOL_NOTIFICATION_PATTERN);
  if (match) {
    const [, icon, toolName, detail] = match;
    const isCost = icon.startsWith(COST_PREFIX);
    const color = isCost ? DEFAULT_INFO_COLOR : getToolColor(toolName);

    if (isCost) {
      // Cost line has no tool/detail split — show the full backtick content.
      const body = detail ? `${toolName}: ${detail}` : toolName;
      return {
        color,
        text: `${icon} \`${body}\``,
        fallback: text,
        mrkdwn_in: ["text"],
      };
    }

    // Regular tool notification: title shows icon + tool name, text shows
    // the detail (if any) as an inline code span.
    const displayName = toolName.startsWith("mcp__")
      ? toolName.replace(/^mcp__/, "").replace(/__/g, " › ")
      : toolName;

    // Note: `title` is always plain text in Slack attachments — mrkdwn_in
    // only accepts "text" | "pretext" | "fields". Emoji work fine in title.
    const attachment: MessageAttachment = {
      color,
      title: `${icon} ${displayName}`,
      fallback: text,
      mrkdwn_in: ["text"],
    };
    if (detail) {
      attachment.text = `\`${detail}\``;
    }
    return attachment;
  }

  // --- Agent reply (markdown body) ---
  return {
    color: DEFAULT_REPLY_COLOR,
    text: markdownToMrkdwn(text),
    fallback: text.slice(0, 100),
    mrkdwn_in: ["text"],
  };
}
