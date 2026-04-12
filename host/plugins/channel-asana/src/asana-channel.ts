import fs from "node:fs";
import path from "node:path";

import type {
  Channel,
  ChannelFactory,
  ChannelOpts,
} from "@nagi/channel-core";
import { createLogger } from "@nagi/logger";
import {
  AsanaClient,
  type AsanaStory,
  type AsanaTask,
  type AsanaTaskDetails,
} from "./asana-client.js";
import { stripHtml } from "./mention-parser.js";

const logger = createLogger({ name: "channel-asana" });

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const MIN_POLL_INTERVAL_MS = 10_000;
const POLL_STATE_FILE = "asana-poll-state.json";

export interface AsanaChannelConfig {
  /** Personal Access Token from https://app.asana.com/0/my-apps */
  personalAccessToken: string;
  /** Your Asana user gid. If omitted, fetched from /users/me during connect(). */
  userGid?: string;
  /** Project gids to watch for mentions. */
  projectGids: string[];
  assistantName?: string;
  triggerPattern?: RegExp;
  /** Polling interval in milliseconds. Default 60s, minimum 10s. */
  pollIntervalMs?: number;
  /** Directory for persisting poll state across restarts. */
  stateDir?: string;
  /** Injected for tests. */
  clientFactory?: (token: string) => AsanaClient;
}

interface ResolvedConfig {
  assistantName: string;
  triggerPattern: RegExp;
  projectGids: string[];
  pollIntervalMs: number;
}

/**
 * Asana channel.
 *
 * Unlike Slack/Discord which push events via persistent connections, Asana's
 * non-Enterprise plans offer no story/comment feed. This channel polls each
 * configured project for new task comments, keeps the ones whose body matches
 * the configured trigger pattern (e.g. `@ai ...`), and feeds them into the
 * nagi message pipeline — matching the Slack/Discord behavior of "respond
 * to any trigger in a watched room".
 *
 * Because nagi authenticates via a Personal Access Token it has no real Asana
 * user and therefore cannot be @mentioned through the autocomplete UI, so
 * the trigger-pattern gate is the only viable detection mechanism.
 *
 * ## Reply routing: auto-subtasks
 *
 * To keep the parent task's comment thread clean, the first trigger on a
 * parent task causes the channel to create a subtask named after the user's
 * request, post a short Japanese link comment on the parent pointing at it,
 * and route the agent's reply (plus any agent-hooks `Thinking`/cost messages)
 * to the subtask instead. The subtask gid is remembered in `watchedSubtasks`
 * and polled alongside the project's direct tasks, so a follow-up `@ai`
 * comment posted inside the subtask is dispatched without creating another
 * nesting level.
 *
 * If subtask creation or the parent link comment fails, the channel silently
 * falls back to replying on the parent task — the contract is "never throw".
 */
export class AsanaChannel implements Channel {
  readonly name = "asana";

  private readonly client: AsanaClient;
  private readonly config: ResolvedConfig;
  private readonly opts: ChannelOpts;
  private readonly stateDir: string | undefined;

  private userGid: string | undefined;
  private connected = false;
  /** ISO timestamp set on connect(); used as the default story cursor so that
   *  the very first poll of a task ignores comments posted before nagi started. */
  private connectedAt: string | undefined;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private polling = false;

  /** projectJid -> most recently triggered taskGid (for routing replies) */
  private readonly lastTaskGid = new Map<string, string>();
  /** taskGid -> last seen story created_at ISO timestamp */
  private readonly lastStoryTs = new Map<string, string>();
  /** projectGid -> last poll time (ISO) used as `modified_since` for the next poll */
  private readonly lastPollTs = new Map<string, string>();
  /** Stories already dispatched — guards against re-processing within a run */
  private readonly seenStoryGids = new Set<string>();
  /**
   * projectGid -> set of subtask gids that nagi created as conversation
   * threads. Polled on every tick so that follow-up triggers inside an
   * agent subtask are picked up. Also used to detect follow-ups (skip
   * creating a new subtask if the triggering task is already one of ours).
   */
  private readonly watchedSubtasks = new Map<string, Set<string>>();

  constructor(config: AsanaChannelConfig, opts: ChannelOpts) {
    const assistantName = config.assistantName ?? "Andy";
    this.config = {
      assistantName,
      triggerPattern:
        config.triggerPattern ?? new RegExp(`^@${assistantName}\\b`, "i"),
      projectGids: config.projectGids,
      pollIntervalMs: Math.max(
        MIN_POLL_INTERVAL_MS,
        config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      ),
    };
    this.opts = opts;
    this.userGid = config.userGid;
    this.stateDir = config.stateDir;

    this.client =
      config.clientFactory?.(config.personalAccessToken) ??
      new AsanaClient({ personalAccessToken: config.personalAccessToken });
  }

  async connect(): Promise<void> {
    if (this.config.projectGids.length === 0) {
      logger.warn("No ASANA_PROJECT_GIDS configured, channel will be idle");
    }

    if (!this.userGid) {
      try {
        const me = await this.client.getUsersMe();
        this.userGid = me.gid;
        logger.info(
          { userGid: this.userGid, name: me.name },
          "Resolved Asana user via /users/me",
        );
      } catch (err) {
        logger.error(
          { err },
          "Failed to resolve Asana user, channel not connected",
        );
        return;
      }
    } else {
      logger.info({ userGid: this.userGid }, "Using preconfigured Asana user");
    }

    // Restore poll state from disk if available, otherwise seed with `now`
    // so the first poll only sees newly modified tasks.
    const saved = this.loadPollState();
    const now = new Date().toISOString();
    if (saved) {
      for (const projectGid of this.config.projectGids) {
        this.lastPollTs.set(projectGid, saved.lastPollTs[projectGid] ?? now);
      }
      // Restore per-task story cursors so already-dispatched stories
      // are not re-processed after restart.
      if (saved.lastStoryTs) {
        for (const [taskGid, ts] of Object.entries(saved.lastStoryTs)) {
          this.lastStoryTs.set(taskGid, ts);
        }
      }
      // connectedAt = min(restored lastPollTs) so story-level cursor
      // matches the tightest recovery window for NEW tasks.
      const timestamps = [...this.lastPollTs.values()];
      this.connectedAt = timestamps.reduce((a, b) => (a < b ? a : b));
      logger.info(
        {
          connectedAt: this.connectedAt,
          projects: Object.keys(saved.lastPollTs).length,
          stories: Object.keys(saved.lastStoryTs ?? {}).length,
        },
        "Restored Asana poll state from disk",
      );
    } else {
      this.connectedAt = now;
      for (const projectGid of this.config.projectGids) {
        this.lastPollTs.set(projectGid, now);
      }
    }

    this.connected = true;
    await this.syncGroups(false);
    this.startPolling();
    logger.info(
      { projects: this.config.projectGids.length, intervalMs: this.config.pollIntervalMs },
      "Asana channel connected",
    );
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.connected) {
      logger.warn({ jid }, "Asana channel not connected, dropping reply");
      return;
    }

    const taskGid = this.lastTaskGid.get(jid);
    if (!taskGid) {
      logger.warn(
        { jid },
        "No recent task tracked for project, cannot route reply",
      );
      return;
    }

    try {
      await this.client.createStoryOnTask(taskGid, { text });
      logger.info({ jid, taskGid, length: text.length }, "Asana reply posted");
    } catch (err) {
      logger.warn(
        { jid, taskGid, err },
        "Failed to post Asana story (dropped)",
      );
      // never throw — matches the contract of the other channels
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith("asana:");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info("Asana channel disconnected");
  }

  async setTyping(_jid: string, _isTyping: boolean): Promise<void> {
    // no-op: Asana has no typing indicator
  }

  async syncGroups(_force: boolean): Promise<void> {
    for (const projectGid of this.config.projectGids) {
      try {
        const project = await this.client.getProject(projectGid);
        this.opts.onChatMetadata(
          `asana:${projectGid}`,
          new Date().toISOString(),
          project.name,
          "asana",
          true,
        );
      } catch (err) {
        logger.warn(
          { projectGid, err },
          "Failed to fetch Asana project metadata",
        );
      }
    }
  }

  // --- poll state persistence -------------------------------------------------

  private loadPollState(): {
    lastPollTs: Record<string, string>;
    connectedAt: string;
    lastStoryTs?: Record<string, string>;
  } | null {
    if (!this.stateDir) return null;
    const filePath = path.join(this.stateDir, POLL_STATE_FILE);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as Record<string, unknown>;
      if (
        typeof data.lastPollTs === "object" &&
        data.lastPollTs !== null &&
        typeof data.connectedAt === "string"
      ) {
        return data as {
          lastPollTs: Record<string, string>;
          connectedAt: string;
          lastStoryTs?: Record<string, string>;
        };
      }
      logger.warn({ filePath }, "Invalid Asana poll state format, ignoring");
      return null;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      logger.warn({ filePath, err }, "Failed to load Asana poll state");
      return null;
    }
  }

  private savePollState(): void {
    if (!this.stateDir) return;
    const filePath = path.join(this.stateDir, POLL_STATE_FILE);
    const tmpPath = `${filePath}.tmp`;
    try {
      const state = {
        lastPollTs: Object.fromEntries(this.lastPollTs),
        connectedAt: this.connectedAt,
        lastStoryTs: Object.fromEntries(this.lastStoryTs),
      };
      fs.mkdirSync(this.stateDir, { recursive: true });
      fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2) + "\n");
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      logger.warn({ err }, "Failed to save Asana poll state");
    }
  }

  // --- polling ---------------------------------------------------------------

  private startPolling(): void {
    const tick = async () => {
      if (!this.connected) return;
      if (!this.polling) {
        this.polling = true;
        try {
          await this.pollOnce();
        } catch (err) {
          logger.error({ err }, "Asana poll failed");
        } finally {
          this.polling = false;
        }
      }
      if (this.connected) {
        this.pollTimer = setTimeout(tick, this.config.pollIntervalMs);
      }
    };
    // Kick the first poll immediately (non-blocking).
    this.pollTimer = setTimeout(tick, 0);
  }

  private async pollOnce(): Promise<void> {
    // Sequential across projects to stay well under rate limits.
    for (const projectGid of this.config.projectGids) {
      if (!this.connected) return;
      try {
        await this.pollProject(projectGid);
      } catch (err) {
        logger.warn({ projectGid, err }, "Asana project poll failed");
      }
    }
  }

  private async pollProject(projectGid: string): Promise<void> {
    const modifiedSince = this.lastPollTs.get(projectGid);
    const nextPollTs = new Date().toISOString();

    const tasks = await this.client.getTasksInProject(projectGid, {
      modifiedSince,
    });

    for (const task of tasks) {
      if (!this.connected) return;
      await this.pollTaskStories(projectGid, task);
    }

    // Also sweep subtasks nagi has created as conversation threads, since
    // Asana's project/tasks endpoint does not return subtasks.
    const watched = this.watchedSubtasks.get(projectGid);
    if (watched) {
      for (const subtaskGid of watched) {
        if (!this.connected) return;
        await this.pollTaskStories(projectGid, {
          gid: subtaskGid,
          name: "",
          modified_at: "",
        });
      }
    }

    this.lastPollTs.set(projectGid, nextPollTs);
    this.savePollState();
  }

  private async pollTaskStories(
    projectGid: string,
    task: AsanaTask,
  ): Promise<void> {
    // Default to connectedAt for first-time tasks so we ignore historical
    // stories that existed before nagi started.
    const lastSeen = this.lastStoryTs.get(task.gid) ?? this.connectedAt;
    let stories: AsanaStory[];
    try {
      stories = await this.client.getStoriesForTask(task.gid);
    } catch (err) {
      logger.warn(
        { projectGid, taskGid: task.gid, err },
        "Failed to fetch Asana stories",
      );
      return;
    }

    // Sort by created_at ascending so we dispatch in chronological order
    // and can advance lastStoryTs monotonically.
    stories.sort((a, b) => a.created_at.localeCompare(b.created_at));

    let newestTs = lastSeen;
    for (const story of stories) {
      if (lastSeen && story.created_at <= lastSeen) continue;
      if (this.seenStoryGids.has(story.gid)) continue;
      this.seenStoryGids.add(story.gid);

      newestTs =
        !newestTs || story.created_at > newestTs ? story.created_at : newestTs;

      if (!this.isHumanComment(story)) continue;
      if (this.isSelfAuthored(story)) continue;

      const body = stripHtml(story.html_text ?? story.text);
      if (!this.config.triggerPattern.test(body)) continue;

      await this.dispatchStory(projectGid, task, story, body, stories);
    }

    if (newestTs && newestTs !== lastSeen) {
      this.lastStoryTs.set(task.gid, newestTs);
    }
  }

  private isHumanComment(story: AsanaStory): boolean {
    // Asana distinguishes comments from system stories via resource_subtype.
    if (story.resource_subtype) {
      return story.resource_subtype === "comment_added";
    }
    // Older responses may only expose `type`.
    return story.type === "comment";
  }

  private isSelfAuthored(story: AsanaStory): boolean {
    return !!(
      this.userGid &&
      story.created_by &&
      story.created_by.gid === this.userGid
    );
  }

  private async dispatchStory(
    projectGid: string,
    task: AsanaTask,
    story: AsanaStory,
    content: string,
    allStories: AsanaStory[],
  ): Promise<void> {
    const jid = `asana:${projectGid}`;
    const timestamp = story.created_at;

    this.opts.onChatMetadata(jid, timestamp, undefined, "asana", true);

    const groups = this.opts.registeredGroups();
    if (!groups[jid]) {
      logger.debug(
        { jid, taskGid: task.gid },
        "Trigger found in unregistered project, skipping dispatch",
      );
      return;
    }

    const senderGid = story.created_by?.gid ?? "";
    const senderName = story.created_by?.name ?? "unknown";
    const sender = senderGid
      ? { gid: senderGid, name: senderName }
      : undefined;

    // Routing decision:
    //   - If the triggering task is already one of our watched subtasks,
    //     this is a follow-up turn inside an existing conversation — reply
    //     in the same task.
    //   - Otherwise, create a fresh subtask so the parent task's comment
    //     stream stays clean. If the API calls fail, fall back to replying
    //     on the parent.
    const watched = this.watchedSubtasks.get(projectGid);
    const isFollowUp = watched?.has(task.gid) ?? false;

    let replyTaskGid = task.gid;
    if (!isFollowUp) {
      const subtaskGid = await this.createReplySubtask(task, content, sender);
      if (subtaskGid) {
        replyTaskGid = subtaskGid;
        this.addWatchedSubtask(projectGid, subtaskGid);
      }
    }

    this.lastTaskGid.set(jid, replyTaskGid);

    // Append an <asana_task> context block so the agent has task name,
    // description, parent info and comment history when it answers.
    //
    // IMPORTANT: the context goes AFTER the user message, not before,
    // because MessageLoop's trigger check uses `/^@ai\b/` on the raw
    // content — leading context would kill the match and the agent
    // would never run.
    const contextBlock = await this.buildContextBlock(task, allStories);
    const enrichedContent = contextBlock
      ? `${content}\n\n${contextBlock}`
      : content;

    this.opts.onMessage(jid, {
      id: story.gid,
      chat_jid: jid,
      sender: senderGid,
      sender_name: senderName,
      content: enrichedContent,
      timestamp,
      is_from_me: false,
      is_bot_message: false,
    });

    logger.info(
      {
        jid,
        parentTaskGid: task.gid,
        replyTaskGid,
        storyGid: story.gid,
        sender: senderName,
        followUp: isFollowUp,
        contextInjected: contextBlock.length > 0,
      },
      "Asana trigger dispatched",
    );
  }

  /**
   * Fetch the task's name/notes/parent details and combine them with the
   * already-loaded story list into a compact `<asana_task>` block that the
   * agent can read as grounding context before answering. Returns an empty
   * string if the fetch fails — dispatch still proceeds without context.
   */
  private async buildContextBlock(
    task: AsanaTask,
    allStories: AsanaStory[],
  ): Promise<string> {
    let details: AsanaTaskDetails;
    try {
      details = await this.client.getTask(task.gid);
    } catch (err) {
      logger.warn(
        { taskGid: task.gid, err },
        "Failed to fetch Asana task details for context",
      );
      return "";
    }

    const lines: string[] = ["<asana_task>"];
    lines.push(`name: ${details.name || "(untitled)"}`);

    const notes = (details.notes ?? "").trim();
    if (notes) {
      lines.push("description:");
      for (const line of notes.split("\n")) {
        lines.push(`  ${line}`);
      }
    }

    if (details.parent) {
      lines.push("parent_task:");
      lines.push(`  name: ${details.parent.name || "(untitled)"}`);
      const parentNotes = (details.parent.notes ?? "").trim();
      if (parentNotes) {
        lines.push("  description:");
        for (const line of parentNotes.split("\n")) {
          lines.push(`    ${line}`);
        }
      }
    }

    const comments = allStories
      .filter((s) => this.isHumanComment(s))
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (comments.length > 0) {
      lines.push("comments:");
      for (const s of comments) {
        const who = s.created_by?.name ?? s.created_by?.gid ?? "unknown";
        const when = s.created_at;
        const body = stripHtml(s.html_text ?? s.text)
          .replace(/\s+/g, " ")
          .trim();
        if (!body) continue;
        lines.push(`  - [${when}] ${who}: ${body}`);
      }
    }

    lines.push("</asana_task>");
    return lines.join("\n");
  }

  /**
   * Create a reply subtask under `parent` and post a short Japanese pointer
   * comment on the parent task so humans can find the conversation.
   *
   * The pointer comment is the ONLY place where the triggering user gets
   * an @mention (a structured `<a data-asana-gid="...">@Name</a>` anchor
   * posted via `html_text`). That fires exactly one Asana notification per
   * turn, telling the user "go check the subtask", while the actual agent
   * reply + hook messages inside the subtask stay as plain text — otherwise
   * every Thinking/cost notifier would ping the user again.
   *
   * Returns the new subtask gid on success, or `undefined` if anything
   * fails (in which case the caller falls back to replying on the parent
   * directly).
   */
  private async createReplySubtask(
    parent: AsanaTask,
    content: string,
    sender?: { gid: string; name: string },
  ): Promise<string | undefined> {
    let subtask: AsanaTask;
    try {
      subtask = await this.client.createSubtask(parent.gid, {
        name: this.buildSubtaskName(content),
      });
    } catch (err) {
      logger.warn(
        { parentTaskGid: parent.gid, err },
        "Failed to create Asana reply subtask, falling back to parent",
      );
      return undefined;
    }

    // Pointer comment on the parent — best effort, not fatal.
    try {
      const url = `https://app.asana.com/0/0/${subtask.gid}`;
      if (sender?.gid) {
        // Asana strips URL auto-linking from html_text, so both the user
        // mention and the subtask reference have to be wrapped in explicit
        // <a> anchors. `data-asana-gid` lets Asana render the subtask as a
        // clickable task chip instead of a raw URL.
        const mention = `<a data-asana-gid="${sender.gid}">@${escapeHtml(
          sender.name || "user",
        )}</a>`;
        const taskLink = `<a href="${url}" data-asana-gid="${subtask.gid}" data-asana-type="task">${escapeHtml(
          subtask.name || url,
        )}</a>`;
        const prefix = escapeHtml("🤖 こちらのサブタスクで返信します: ");
        await this.client.createStoryOnTask(parent.gid, {
          htmlText: `<body>${mention} ${prefix}${taskLink}</body>`,
        });
      } else {
        // Plain-text fallback keeps Asana's auto-linking so the URL still
        // renders as a task chip even without a sender mention.
        await this.client.createStoryOnTask(parent.gid, {
          text: `🤖 こちらのサブタスクで返信します: ${url}`,
        });
      }
    } catch (err) {
      logger.warn(
        { parentTaskGid: parent.gid, subtaskGid: subtask.gid, err },
        "Failed to post Asana parent-link comment (reply will still land on the subtask)",
      );
    }

    logger.info(
      { parentTaskGid: parent.gid, subtaskGid: subtask.gid, name: subtask.name },
      "Created Asana reply subtask",
    );
    return subtask.gid;
  }

  private buildSubtaskName(content: string): string {
    // Strip a leading trigger mention (e.g. "@ai ") and take the first line,
    // then truncate to a compact length that reads well in Asana's UI.
    const withoutTrigger = content.replace(/^\s*@\S+\s*/u, "");
    const firstLine = withoutTrigger.split("\n")[0].trim();
    const maxLen = 60;
    const truncated =
      firstLine.length > maxLen
        ? `${firstLine.slice(0, maxLen - 1)}…`
        : firstLine;
    return `ai ▸ ${truncated || "conversation"}`;
  }

  private addWatchedSubtask(projectGid: string, subtaskGid: string): void {
    let set = this.watchedSubtasks.get(projectGid);
    if (!set) {
      set = new Set();
      this.watchedSubtasks.set(projectGid, set);
    }
    set.add(subtaskGid);
  }
}

export function createAsanaFactory(
  config: AsanaChannelConfig,
): ChannelFactory {
  return (opts: ChannelOpts) => new AsanaChannel(config, opts);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
