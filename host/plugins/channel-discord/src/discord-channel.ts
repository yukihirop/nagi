import {
  Client,
  Events,
  GatewayIntentBits,
  Message,
  Partials,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import type { Channel, ChannelOpts, ChannelFactory } from "@nagi/channel-core";
import { createLogger } from "@nagi/logger";

const logger = createLogger({ name: "channel-discord" });

const DISCORD_MAX_MESSAGE_LENGTH = 2000;

export interface DiscordChannelConfig {
  botToken: string;
  assistantName?: string;
  triggerPattern?: RegExp;
}

export class DiscordChannel implements Channel {
  name = "discord";

  protected client: Client | null = null;
  private config: Required<DiscordChannelConfig>;
  private opts: ChannelOpts;
  protected lastMessageId = new Map<string, string>();

  constructor(config: DiscordChannelConfig, opts: ChannelOpts) {
    const assistantName = config.assistantName ?? "Andy";
    this.config = {
      botToken: config.botToken,
      assistantName,
      triggerPattern:
        config.triggerPattern ?? new RegExp(`^@${assistantName}\\b`, "i"),
    };
    this.opts = opts;
  }

  async connect(): Promise<void> {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel],
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot) return;

      const channelId = message.channelId;
      const chatJid = `discord:${channelId}`;
      let content = message.content;
      const timestamp = message.createdAt.toISOString();
      const senderName =
        message.member?.displayName ||
        message.author.displayName ||
        message.author.username;
      const sender = message.author.id;
      const msgId = message.id;

      // Determine chat name
      let chatName: string;
      if (message.guild) {
        const textChannel = message.channel as TextChannel;
        chatName = `${message.guild.name} #${textChannel.name}`;
      } else {
        chatName = senderName;
      }

      // Translate Discord @bot mentions into trigger format
      if (this.client?.user) {
        const botId = this.client.user.id;
        const isBotMentioned =
          message.mentions.users.has(botId) ||
          content.includes(`<@${botId}>`) ||
          content.includes(`<@!${botId}>`);

        if (isBotMentioned) {
          content = content
            .replace(new RegExp(`<@!?${botId}>`, "g"), "")
            .trim();
          if (!this.config.triggerPattern.test(content)) {
            content = `@${this.config.assistantName} ${content}`;
          }
        }
      }

      // Handle attachments
      if (message.attachments.size > 0) {
        const attachmentDescriptions = [...message.attachments.values()].map(
          (att) => {
            const contentType = att.contentType || "";
            if (contentType.startsWith("image/")) {
              return `[Image: ${att.name || "image"}]`;
            } else if (contentType.startsWith("video/")) {
              return `[Video: ${att.name || "video"}]`;
            } else if (contentType.startsWith("audio/")) {
              return `[Audio: ${att.name || "audio"}]`;
            } else {
              return `[File: ${att.name || "file"}]`;
            }
          },
        );
        if (content) {
          content = `${content}\n${attachmentDescriptions.join("\n")}`;
        } else {
          content = attachmentDescriptions.join("\n");
        }
      }

      // Handle reply context
      if (message.reference?.messageId) {
        try {
          const repliedTo = await message.channel.messages.fetch(
            message.reference.messageId,
          );
          const replyAuthor =
            repliedTo.member?.displayName ||
            repliedTo.author.displayName ||
            repliedTo.author.username;
          content = `[Reply to ${replyAuthor}] ${content}`;
        } catch {
          // Referenced message may have been deleted
        }
      }

      // Store chat metadata for discovery
      const isGroup = message.guild !== null;
      this.opts.onChatMetadata(chatJid, timestamp, chatName, "discord", isGroup);

      // Only deliver full message for registered groups
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) {
        logger.debug(
          { chatJid, chatName },
          "Message from unregistered Discord channel",
        );
        return;
      }

      this.lastMessageId.set(chatJid, msgId);

      this.opts.onMessage(chatJid, {
        id: msgId,
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
      });

      logger.info(
        { chatJid, chatName, sender: senderName },
        "Discord message stored",
      );
    });

    this.client.on(Events.Error, (err) => {
      logger.error({ err: err.message }, "Discord client error");
    });

    return new Promise<void>((resolve) => {
      this.client!.once(Events.ClientReady, (readyClient) => {
        logger.info(
          { username: readyClient.user.tag, id: readyClient.user.id },
          "Discord bot connected",
        );
        resolve();
      });

      this.client!.login(this.config.botToken);
    });
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.client) {
      logger.warn("Discord client not initialized");
      return;
    }

    try {
      const channelId = jid.replace(/^discord:/, "");
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !("send" in channel)) {
        logger.warn({ jid }, "Discord channel not found or not text-based");
        return;
      }

      const textChannel = channel as TextChannel;
      const messageId = this.lastMessageId.get(jid);

      // Try to reply in a thread on the original message
      let target: TextChannel | ThreadChannel = textChannel;
      if (messageId) {
        try {
          const originalMessage = await textChannel.messages.fetch(messageId);
          if (originalMessage.thread) {
            target = originalMessage.thread;
          } else {
            const threadName = text
              .slice(0, 50)
              .replace(/\n/g, " ")
              .replace(/[*_~`|]/g, "");
            target = await originalMessage.startThread({
              name: threadName || "Response",
              autoArchiveDuration: 60,
            });
          }
        } catch (err) {
          logger.debug(
            { jid, err },
            "Failed to create thread, falling back to channel",
          );
        }
      }

      // Discord has a 2000 character limit per message
      if (text.length <= DISCORD_MAX_MESSAGE_LENGTH) {
        await target.send(text);
      } else {
        for (
          let i = 0;
          i < text.length;
          i += DISCORD_MAX_MESSAGE_LENGTH
        ) {
          await target.send(text.slice(i, i + DISCORD_MAX_MESSAGE_LENGTH));
        }
      }
      logger.info({ jid, length: text.length }, "Discord message sent");
    } catch (err) {
      logger.error({ jid, err }, "Failed to send Discord message");
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.client.isReady();
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith("discord:");
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      logger.info("Discord bot stopped");
    }
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (!this.client || !isTyping) return;
    try {
      const channelId = jid.replace(/^discord:/, "");
      const channel = await this.client.channels.fetch(channelId);
      if (channel && "sendTyping" in channel) {
        await (channel as TextChannel).sendTyping();
      }
    } catch (err) {
      logger.debug({ jid, err }, "Failed to send Discord typing indicator");
    }
  }
}

export function createDiscordFactory(
  config: DiscordChannelConfig,
): ChannelFactory {
  return (opts: ChannelOpts) => new DiscordChannel(config, opts);
}
