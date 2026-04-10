import type { ChannelOpts, ChannelFactory } from "@nagi/channel-core";
import type { SlackChannelConfig } from "@nagi/channel-slack";
import { SlackBlockKitChannel } from "@nagi/channel-slack-block-kit";
import { createLogger } from "@nagi/logger";
import { formatEmbedAttachment } from "./embed-formatter.js";

const logger = createLogger({ name: "channel-slack-block-kit-embed" });

export class SlackBlockKitEmbedChannel extends SlackBlockKitChannel {
  override async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.isConnected()) {
      return super.sendMessage(jid, text);
    }

    const channelId = jid.replace(/^slack:/, "");
    const thread_ts = this.lastThreadTs.get(jid);
    const attachment = formatEmbedAttachment(text);

    try {
      await this.app.client.chat.postMessage({
        channel: channelId,
        thread_ts,
        attachments: [attachment],
      });
      logger.info(
        { jid, color: attachment.color },
        "Block Kit embed attachment sent",
      );
    } catch (err) {
      logger.warn(
        { jid, err },
        "Embed attachment send failed, falling back to Block Kit",
      );
      // Fall back to the parent class (Block Kit blocks, no color bar).
      await super.sendMessage(jid, text);
    }
  }
}

export type { SlackChannelConfig };

export function createSlackFactory(
  config: SlackChannelConfig,
): ChannelFactory {
  return (opts: ChannelOpts) => new SlackBlockKitEmbedChannel(config, opts);
}
