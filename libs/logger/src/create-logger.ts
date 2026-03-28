import pino from "pino";

export interface CreateLoggerOptions {
  /** Name included in log output (e.g., "orchestrator", "scheduler") */
  name?: string;
  /** Log level. Defaults to LOG_LEVEL env var or "info" */
  level?: string;
  /** Use pino-pretty for human-readable output. Defaults to NODE_ENV !== "production" */
  pretty?: boolean;
}

export function createLogger(opts?: CreateLoggerOptions): pino.Logger {
  const level = opts?.level ?? process.env.LOG_LEVEL ?? "info";
  const pretty = opts?.pretty ?? process.env.NODE_ENV !== "production";

  const options: pino.LoggerOptions = {
    level,
  };

  if (opts?.name) {
    options.name = opts.name;
  }

  if (pretty) {
    options.transport = {
      target: "pino-pretty",
      options: { colorize: true },
    };
  }

  return pino(options);
}
