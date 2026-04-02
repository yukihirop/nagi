import type { ChannelOpts, ChannelFactory } from "@nagi/channel-core";
import { SlackChannel } from "@nagi/channel-slack";
import type { SlackChannelConfig } from "@nagi/channel-slack";
import { createLogger } from "@nagi/logger";
import {
  formatToolNotification,
  formatMarkdownToBlockKit,
} from "./block-kit-formatter.js";

const logger = createLogger({ name: "channel-slack-block-kit" });

const SLACK_MAX_BLOCKS = 50;

export class SlackBlockKitChannel extends SlackChannel {
  override async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.isConnected()) {
      return super.sendMessage(jid, text);
    }

    // Try tool notification first (short single-line messages)
    const toolBlocks = formatToolNotification(text);
    if (toolBlocks) {
      return this.postBlocks(jid, text, toolBlocks);
    }

    // Convert markdown response to Block Kit
    const blocks = formatMarkdownToBlockKit(text);
    return this.postBlocks(jid, text, blocks);
  }

  private async postBlocks(
    jid: string,
    fallbackText: string,
    blocks: import("@slack/types").KnownBlock[],
  ): Promise<void> {
    const channelId = jid.replace(/^slack:/, "");

    try {
      const thread_ts = this.lastThreadTs.get(jid);

      // Slack limits to 50 blocks per message — split if needed
      if (blocks.length <= SLACK_MAX_BLOCKS) {
        await this.app.client.chat.postMessage({
          channel: channelId,
          text: fallbackText,
          blocks,
          thread_ts,
        });
      } else {
        for (let i = 0; i < blocks.length; i += SLACK_MAX_BLOCKS) {
          await this.app.client.chat.postMessage({
            channel: channelId,
            text: fallbackText,
            blocks: blocks.slice(i, i + SLACK_MAX_BLOCKS),
            thread_ts,
          });
        }
      }
      logger.info({ jid, blockCount: blocks.length }, "Block Kit message sent");
    } catch (err) {
      logger.warn({ jid, err }, "Block Kit send failed, falling back to text");
      await super.sendMessage(jid, fallbackText);
    }
  }
}

export type { SlackChannelConfig };

export function createSlackFactory(
  config: SlackChannelConfig,
): ChannelFactory {
  return (opts: ChannelOpts) => new SlackBlockKitChannel(config, opts);
}
