import type { ChannelInfo } from "../types.ts";

export type ChannelsState = {
  channels: ChannelInfo[];
  loading: boolean;
};

export function initialChannelsState(): ChannelsState {
  return { channels: [], loading: false };
}
