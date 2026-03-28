import type { GroupInfo } from "../types.ts";

export type GroupsState = {
  groups: GroupInfo[];
  loading: boolean;
};

export function initialGroupsState(): GroupsState {
  return { groups: [], loading: false };
}
