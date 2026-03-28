import type { TaskInfo } from "../types.ts";

export type TasksState = {
  tasks: TaskInfo[];
  loading: boolean;
};

export function initialTasksState(): TasksState {
  return { tasks: [], loading: false };
}
