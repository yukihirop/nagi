import type { ChannelOpts, ChannelFactory } from "@nagi/channel-core";
import { SlackChannel } from "@nagi/channel-slack";
import type { SlackChannelConfig } from "@nagi/channel-slack";
import { createLogger } from "@nagi/logger";
import { formatToBlockKit } from "./block-kit-formatter.js";

const logger = createLogger({ name: "channel-slack-block-kit" });

export class SlackBlockKitChannel extends SlackChannel {
  override async sendMessage(jid: string, text: string): Promise<void> {
    const blocks = formatToBlockKit(text);
    if (!blocks) {
      return super.sendMessage(jid, text);
    }

    const channelId = jid.replace(/^slack:/, "");

    if (!this.isConnected()) {
      return super.sendMessage(jid, text);
    }

    try {
      const thread_ts = this.lastThreadTs.get(jid);

      await this.app.client.chat.postMessage({
        channel: channelId,
        text, // fallback for notifications / accessibility
        blocks,
        thread_ts,
      });
      logger.info({ jid, blockCount: blocks.length }, "Block Kit message sent");
    } catch (err) {
      logger.warn({ jid, err }, "Block Kit send failed, falling back to text");
      await super.sendMessage(jid, text);
    }
  }
}

export type { SlackChannelConfig };

export function createSlackFactory(
  config: SlackChannelConfig,
): ChannelFactory {
  return (opts: ChannelOpts) => new SlackBlockKitChannel(config, opts);
}
