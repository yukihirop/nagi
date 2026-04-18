#!/usr/bin/env node
// Reachability check CLI.
// Usage:   node reachability.mjs <channel> <id> <assistantName>
// Output:  JSON { ok: boolean, reason?: string, detail?: object }
// Exit:    0 always (caller reads the JSON — a negative result is still "OK" execution)

import fs from "node:fs";
import path from "node:path";

const [, , channel, id, assistantName] = process.argv;

if (!channel || !id || !assistantName) {
  console.log(JSON.stringify({ ok: false, reason: "usage: <channel> <id> <assistantName>" }));
  process.exit(2);
}

function readEnv(key) {
  const envPath = path.resolve(process.cwd(), `deploy/${assistantName}/.env`);
  if (!fs.existsSync(envPath)) return null;
  const line = fs.readFileSync(envPath, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : null;
}

async function checkSlack() {
  const token = readEnv("SLACK_BOT_TOKEN");
  if (!token) return { ok: false, reason: "SLACK_BOT_TOKEN missing in .env" };

  const auth = await fetch("https://slack.com/api/auth.test", {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  if (!auth.ok) return { ok: false, reason: `auth.test failed: ${auth.error}` };

  const members = await fetch(
    `https://slack.com/api/conversations.members?channel=${id}`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((r) => r.json());

  if (!members.ok) {
    return { ok: false, reason: `conversations.members failed: ${members.error}`, detail: { botUserId: auth.user_id } };
  }
  if (!members.members.includes(auth.user_id)) {
    return {
      ok: false,
      reason: "Bot is not a member of this channel. Run `/invite @<bot>` in Slack.",
      detail: { botUserId: auth.user_id, botName: auth.user },
    };
  }
  return { ok: true, detail: { botUserId: auth.user_id, botName: auth.user } };
}

async function checkDiscord() {
  const token = readEnv("DISCORD_BOT_TOKEN");
  if (!token) return { ok: false, reason: "DISCORD_BOT_TOKEN missing in .env" };

  const chanRes = await fetch(`https://discord.com/api/v10/channels/${id}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (chanRes.status !== 200) {
    const body = await chanRes.text();
    return { ok: false, reason: `channels fetch failed: HTTP ${chanRes.status}`, detail: { body } };
  }
  const chan = await chanRes.json();
  const guildId = chan.guild_id;
  if (!guildId) return { ok: true, detail: { channelName: chan.name, note: "DM channel — no guild check" } };

  const guilds = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bot ${token}` },
  }).then((r) => r.json());
  if (!Array.isArray(guilds) || !guilds.some((g) => g.id === guildId)) {
    return {
      ok: false,
      reason: "Bot is not a member of the guild that owns this channel.",
      detail: { guildId, channelName: chan.name },
    };
  }
  return { ok: true, detail: { channelName: chan.name, guildId, guildName: guilds.find((g) => g.id === guildId)?.name } };
}

async function checkAsana() {
  const token = readEnv("ASANA_PAT");
  if (!token) return { ok: false, reason: "ASANA_PAT missing in .env" };

  const res = await fetch(`https://app.asana.com/api/1.0/projects/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200) {
    return {
      ok: false,
      reason: `projects fetch failed: HTTP ${res.status}`,
      detail: { errors: body.errors },
    };
  }
  return { ok: true, detail: { projectName: body.data?.name } };
}

const CHECKS = { slack: checkSlack, discord: checkDiscord, asana: checkAsana };

try {
  const check = CHECKS[channel];
  if (!check) {
    console.log(JSON.stringify({ ok: false, reason: `unknown channel: ${channel}` }));
    process.exit(0);
  }
  const result = await check();
  console.log(JSON.stringify(result));
} catch (err) {
  console.log(JSON.stringify({ ok: false, reason: `exception: ${err.message}` }));
}
