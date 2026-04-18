import { TextChannel, ThreadChannel, EmbedBuilder } from "discord.js";
import type { ChannelOpts, ChannelFactory } from "@nagi/channel-core";
import { DiscordChannel } from "@nagi/channel-discord";
import type { DiscordChannelConfig } from "@nagi/channel-discord";
import { createLogger } from "@nagi/logger";
import { formatToolNotification, formatMarkdownToEmbeds } from "./embed-formatter.js";

const logger = createLogger({ name: "channel-discord-embed" });

const MAX_EMBEDS_PER_MESSAGE = 10;

export class DiscordEmbedChannel extends DiscordChannel {
  override async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.client) {
      return super.sendMessage(jid, text);
    }

    // Try tool notification first
    const toolEmbeds = formatToolNotification(text);
    if (toolEmbeds) {
      return this.postEmbeds(jid, text, toolEmbeds);
    }

    // Convert markdown to embeds
    const embeds = formatMarkdownToEmbeds(text);
    return this.postEmbeds(jid, text, embeds);
  }

  private async postEmbeds(
    jid: string,
    fallbackText: string,
    embeds: EmbedBuilder[],
  ): Promise<void> {
    try {
      const target = await this.resolveTarget(jid, fallbackText);
      if (!target) return;

      // Discord allows max 10 embeds per message
      if (embeds.length <= MAX_EMBEDS_PER_MESSAGE) {
        await target.send({ embeds });
      } else {
        for (let i = 0; i < embeds.length; i += MAX_EMBEDS_PER_MESSAGE) {
          await target.send({ embeds: embeds.slice(i, i + MAX_EMBEDS_PER_MESSAGE) });
        }
      }
      logger.info({ jid, embedCount: embeds.length }, "Discord embed message sent");
    } catch (err) {
      logger.warn({ jid, err }, "Embed send failed, falling back to text");
      await super.sendMessage(jid, fallbackText);
    }
  }

  private async resolveTarget(
    jid: string,
    text: string,
  ): Promise<TextChannel | ThreadChannel | null> {
    if (!this.client) return null;

    const channelId = jid.replace(/^discord:/, "");
    const channel = await this.client.channels.fetch(channelId);

    if (!channel || !("send" in channel)) {
      logger.warn({ jid }, "Discord channel not found or not text-based");
      return null;
    }

    const textChannel = channel as TextChannel;
    const messageId = this.lastMessageId.get(jid);

    if (!messageId) return textChannel;

    try {
      const originalMessage = await textChannel.messages.fetch(messageId);
      if (originalMessage.thread) {
        return originalMessage.thread;
      }
      const threadName = text
        .slice(0, 50)
        .replace(/\n/g, " ")
        .replace(/[*_~`|]/g, "");
      return await originalMessage.startThread({
        name: threadName || "Response",
        autoArchiveDuration: 60,
      });
    } catch (err) {
      logger.debug({ jid, err }, "Failed to create thread, falling back to channel");
      return textChannel;
    }
  }
}

export type { DiscordChannelConfig };

export function createDiscordFactory(
  config: DiscordChannelConfig,
): ChannelFactory {
  return (opts: ChannelOpts) => new DiscordEmbedChannel(config, opts);
}
