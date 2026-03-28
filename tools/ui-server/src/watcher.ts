import fs from "node:fs";
import path from "node:path";
import { createLogger } from "@nagi/logger";

const logger = createLogger({ name: "ui-watcher" });

export interface WatcherOptions {
  dataDir: string;
  onChanged: (event: string) => void;
}

export class IpcFileWatcher {
  private watcher: fs.FSWatcher | null = null;
  private opts: WatcherOptions;

  constructor(opts: WatcherOptions) {
    this.opts = opts;
  }

  start(): void {
    const ipcDir = path.join(this.opts.dataDir, "ipc");

    if (!fs.existsSync(ipcDir)) {
      logger.warn({ ipcDir }, "IPC directory does not exist, watching skipped");
      return;
    }

    this.watcher = fs.watch(ipcDir, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;
      const base = path.basename(filename);

      if (base === "available_groups.json") {
        this.opts.onChanged("groups.changed");
      } else if (base === "current_tasks.json") {
        this.opts.onChanged("tasks.changed");
      } else {
        this.opts.onChanged("state.updated");
      }
    });

    logger.info({ ipcDir }, "IPC file watcher started");
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.info("IPC file watcher stopped");
    }
  }
}
