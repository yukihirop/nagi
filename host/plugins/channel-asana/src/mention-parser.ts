/**
 * Best-effort conversion of Asana html_text to a plain text representation
 * suitable for passing to an LLM. Replaces `<a data-asana-gid="...">` mention
 * anchors with their inner `@Name` text, drops other tags, and decodes
 * common HTML entities.
 *
 * Not a general-purpose HTML sanitizer — Asana's html_text is a constrained
 * subset documented at https://developers.asana.com/docs/rich-text.
 */
export function stripHtml(htmlText: string | undefined): string {
  if (!htmlText) return "";

  let out = htmlText;

  // Asana wraps content in <body>...</body>; drop the wrapper.
  out = out.replace(/^\s*<body>/i, "").replace(/<\/body>\s*$/i, "");

  // Keep mention inner text (`@Name`) and drop the anchor wrapper.
  out = out.replace(
    /<a\s+[^>]*data-asana-gid="\d+"[^>]*>([^<]*)<\/a>/g,
    "$1",
  );

  // Common block tags to newline.
  out = out.replace(/<\/?(p|div|br|ul|ol|li)(\s[^>]*)?>/gi, "\n");

  // Drop everything else.
  out = out.replace(/<[^>]+>/g, "");

  // Decode a minimal set of entities.
  out = out
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Collapse excessive whitespace.
  out = out.replace(/\n{3,}/g, "\n\n").trim();

  return out;
}
