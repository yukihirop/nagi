import { createLogger } from "@nagi/logger";
import type { ScheduledTask } from "@nagi/types";

const logger = createLogger({ name: "scheduler" });

export interface TaskRepo {
  getDue(): ScheduledTask[];
  getById(id: string): ScheduledTask | undefined;
}

export interface TaskQueue {
  enqueueTask(
    groupJid: string,
    taskId: string,
    fn: () => Promise<void>,
  ): void;
}

export interface TaskSchedulerOptions {
  pollInterval: number;
  taskRepo: TaskRepo;
  queue: TaskQueue;
  executor: (task: ScheduledTask) => Promise<void>;
}

export class TaskScheduler {
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private opts: TaskSchedulerOptions;

  constructor(opts: TaskSchedulerOptions) {
    this.opts = opts;
  }

  start(): void {
    if (this.running) {
      logger.debug("Scheduler loop already running, skipping duplicate start");
      return;
    }
    this.running = true;
    logger.info("Scheduler loop started");
    this.poll();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info("Scheduler loop stopped");
  }

  private poll(): void {
    const run = async () => {
      try {
        const dueTasks = this.opts.taskRepo.getDue();
        if (dueTasks.length > 0) {
          logger.info({ count: dueTasks.length }, "Found due tasks");
        }

        for (const task of dueTasks) {
          const currentTask = this.opts.taskRepo.getById(task.id);
          if (!currentTask || currentTask.status !== "active") {
            continue;
          }

          this.opts.queue.enqueueTask(
            currentTask.chat_jid,
            currentTask.id,
            () => this.opts.executor(currentTask),
          );
        }
      } catch (err) {
        logger.error({ err }, "Error in scheduler loop");
      }

      if (this.running) {
        this.timer = setTimeout(() => this.poll(), this.opts.pollInterval);
      }
    };

    run();
  }
}
