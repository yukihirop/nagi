import { App, LogLevel } from "@slack/bolt";
import type { GenericMessageEvent, BotMessageEvent } from "@slack/types";
import type { Channel, ChannelOpts, ChannelFactory } from "@nagi/channel-core";
import { createLogger } from "@nagi/logger";

const logger = createLogger({ name: "channel-slack" });

const SLACK_MAX_MESSAGE_LENGTH = 4000;

type HandledMessageEvent = GenericMessageEvent | BotMessageEvent;

export interface SlackChannelConfig {
  botToken: string;
  appToken: string;
  assistantName?: string;
  triggerPattern?: RegExp;
}

export class SlackChannel implements Channel {
  name = "slack";

  private app: App;
  private config: {
    assistantName: string;
    triggerPattern: RegExp;
  };
  private botUserId: string | undefined;
  private connected = false;
  private outgoingQueue: Array<{ jid: string; text: string }> = [];
  private flushing = false;
  private userNameCache = new Map<string, string>();
  private lastThreadTs = new Map<string, string>();
  private opts: ChannelOpts;

  constructor(config: SlackChannelConfig, opts: ChannelOpts) {
    const assistantName = config.assistantName ?? "Andy";
    this.config = {
      assistantName,
      triggerPattern:
        config.triggerPattern ?? new RegExp(`^@${assistantName}\\b`, "i"),
    };
    this.opts = opts;

    this.app = new App({
      token: config.botToken,
      appToken: config.appToken,
      socketMode: true,
      logLevel: LogLevel.ERROR,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.app.event("message", async ({ event }) => {
      const subtype = (event as { subtype?: string }).subtype;
      if (subtype && subtype !== "bot_message") return;

      const msg = event as HandledMessageEvent;
      if (!msg.text) return;

      const jid = `slack:${msg.channel}`;
      const timestamp = new Date(parseFloat(msg.ts) * 1000).toISOString();
      const isGroup = msg.channel_type !== "im";

      this.opts.onChatMetadata(jid, timestamp, undefined, "slack", isGroup);

      const groups = this.opts.registeredGroups();
      if (!groups[jid]) return;

      const isBotMessage = !!msg.bot_id || msg.user === this.botUserId;

      let senderName: string;
      if (isBotMessage) {
        senderName = this.config.assistantName;
      } else {
        senderName =
          (msg.user ? await this.resolveUserName(msg.user) : undefined) ||
          msg.user ||
          "unknown";
      }

      let content = msg.text;
      if (this.botUserId && !isBotMessage) {
        const mentionPattern = `<@${this.botUserId}>`;
        if (
          content.includes(mentionPattern) &&
          !this.config.triggerPattern.test(content)
        ) {
          content = `@${this.config.assistantName} ${content}`;
        }
      }

      const threadTs = (msg as GenericMessageEvent).thread_ts || msg.ts;
      this.lastThreadTs.set(jid, threadTs);

      this.opts.onMessage(jid, {
        id: msg.ts,
        chat_jid: jid,
        sender: msg.user || msg.bot_id || "",
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: isBotMessage,
        is_bot_message: isBotMessage,
      });
    });
  }

  async connect(): Promise<void> {
    await this.app.start();

    try {
      const auth = await this.app.client.auth.test();
      this.botUserId = auth.user_id as string;
      logger.info({ botUserId: this.botUserId }, "Connected to Slack");
    } catch (err) {
      logger.warn(
        { err },
        "Connected to Slack but failed to get bot user ID",
      );
    }

    this.connected = true;
    await this.flushOutgoingQueue();
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    const channelId = jid.replace(/^slack:/, "");

    if (!this.connected) {
      this.outgoingQueue.push({ jid, text });
      logger.info(
        { jid, queueSize: this.outgoingQueue.length },
        "Slack disconnected, message queued",
      );
      return;
    }

    try {
      const thread_ts = this.lastThreadTs.get(jid);

      if (text.length <= SLACK_MAX_MESSAGE_LENGTH) {
        await this.app.client.chat.postMessage({
          channel: channelId,
          text,
          thread_ts,
        });
      } else {
        for (let i = 0; i < text.length; i += SLACK_MAX_MESSAGE_LENGTH) {
          await this.app.client.chat.postMessage({
            channel: channelId,
            text: text.slice(i, i + SLACK_MAX_MESSAGE_LENGTH),
            thread_ts,
          });
        }
      }
      logger.info({ jid, length: text.length }, "Slack message sent");
    } catch (err) {
      this.outgoingQueue.push({ jid, text });
      logger.warn(
        { jid, err, queueSize: this.outgoingQueue.length },
        "Failed to send Slack message, queued",
      );
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith("slack:");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    await this.app.stop();
    logger.info("Slack bot stopped");
  }

  async setTyping(_jid: string, _isTyping: boolean): Promise<void> {
    // no-op: Slack Bot API has no typing indicator endpoint
  }

  async syncGroups(_force: boolean): Promise<void> {
    try {
      logger.info("Syncing channel metadata from Slack...");
      let cursor: string | undefined;
      let count = 0;

      do {
        const result = await this.app.client.conversations.list({
          types: "public_channel,private_channel",
          exclude_archived: true,
          limit: 200,
          cursor,
        });

        for (const ch of result.channels || []) {
          if (ch.id && ch.name && ch.is_member) {
            this.opts.onChatMetadata(
              `slack:${ch.id}`,
              new Date().toISOString(),
              ch.name,
              "slack",
              true,
            );
            count++;
          }
        }

        cursor = result.response_metadata?.next_cursor || undefined;
      } while (cursor);

      logger.info({ count }, "Slack channel metadata synced");
    } catch (err) {
      logger.error({ err }, "Failed to sync Slack channel metadata");
    }
  }

  private async resolveUserName(
    userId: string,
  ): Promise<string | undefined> {
    if (!userId) return undefined;

    const cached = this.userNameCache.get(userId);
    if (cached) return cached;

    try {
      const result = await this.app.client.users.info({ user: userId });
      const name = result.user?.real_name || result.user?.name;
      if (name) this.userNameCache.set(userId, name);
      return name;
    } catch (err) {
      logger.debug({ userId, err }, "Failed to resolve Slack user name");
      return undefined;
    }
  }

  private async flushOutgoingQueue(): Promise<void> {
    if (this.flushing || this.outgoingQueue.length === 0) return;
    this.flushing = true;
    try {
      logger.info(
        { count: this.outgoingQueue.length },
        "Flushing Slack outgoing queue",
      );
      while (this.outgoingQueue.length > 0) {
        const item = this.outgoingQueue.shift()!;
        const channelId = item.jid.replace(/^slack:/, "");
        await this.app.client.chat.postMessage({
          channel: channelId,
          text: item.text,
        });
        logger.info(
          { jid: item.jid, length: item.text.length },
          "Queued Slack message sent",
        );
      }
    } finally {
      this.flushing = false;
    }
  }
}

export function createSlackFactory(
  config: SlackChannelConfig,
): ChannelFactory {
  return (opts: ChannelOpts) => new SlackChannel(config, opts);
}
