// Shared helpers for JID prefixes, ID validation, and JID composition.
// Imported by register.mjs / reachability.mjs / unregister.mjs.
//
// Single source of truth for channel JID prefixes. All channels use their
// channel name as the prefix (`slack:`, `discord:`, `asana:`).
// Source of truth:
//   host/plugins/channel-slack/src/slack-channel.ts:62  → `slack:${id}`
//   host/plugins/channel-discord/src/discord-channel.ts:57 → `discord:${id}`
//   host/plugins/channel-asana/src/asana-channel.ts:449 → `asana:${id}`

export const PREFIX_MAP = Object.freeze({
  slack: "slack:",
  discord: "discord:",
  asana: "asana:",
});

export const ID_REGEX = Object.freeze({
  slack: /^[CDG][A-Z0-9]+$/,
  discord: /^\d{17,20}$/,
  asana: /^\d+$/,
});

export function prefixFor(channel) {
  const p = PREFIX_MAP[channel];
  if (!p) throw new Error(`Unknown channel: ${channel}`);
  return p;
}

export function validateId(channel, id) {
  const re = ID_REGEX[channel];
  if (!re) throw new Error(`Unknown channel: ${channel}`);
  return re.test(id);
}

export function buildJid(channel, id) {
  return `${prefixFor(channel)}${id}`;
}

export function parseJid(jid) {
  for (const [channel, prefix] of Object.entries(PREFIX_MAP)) {
    if (jid.startsWith(prefix)) {
      return { channel, id: jid.slice(prefix.length) };
    }
  }
  return null;
}

// folder validation mirrors libs/db group-folder.ts constraints:
// alphanumeric + underscore/dash, 1-63 chars, not "global"
export function validateFolder(folder) {
  if (folder === "global") return false;
  return /^[a-zA-Z0-9_-]{1,63}$/.test(folder);
}
