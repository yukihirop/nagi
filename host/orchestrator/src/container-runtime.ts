import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { createLogger } from "@nagi/logger";

const logger = createLogger({ name: "orchestrator" });

export const CONTAINER_RUNTIME_BIN = "docker";
export const CONTAINER_HOST_GATEWAY = "host.docker.internal";

export function detectProxyBindHost(): string {
  const override = process.env.CREDENTIAL_PROXY_HOST;
  if (override) return override;

  if (os.platform() === "darwin") return "127.0.0.1";

  if (fs.existsSync("/proc/sys/fs/binfmt_misc/WSLInterop")) return "127.0.0.1";

  const ifaces = os.networkInterfaces();
  const docker0 = ifaces["docker0"];
  if (docker0) {
    const ipv4 = docker0.find((a) => a.family === "IPv4");
    if (ipv4) return ipv4.address;
  }
  return "0.0.0.0";
}

export function hostGatewayArgs(): string[] {
  if (os.platform() === "linux") {
    return ["--add-host=host.docker.internal:host-gateway"];
  }
  return [];
}

export function readonlyMountArgs(
  hostPath: string,
  containerPath: string,
): string[] {
  return ["-v", `${hostPath}:${containerPath}:ro`];
}

export function stopContainer(name: string): string {
  return `${CONTAINER_RUNTIME_BIN} stop -t 1 ${name}`;
}

export function ensureContainerRuntimeRunning(): void {
  try {
    execSync(`${CONTAINER_RUNTIME_BIN} info`, {
      stdio: "pipe",
      timeout: 10000,
    });
    logger.debug("Container runtime already running");
  } catch (err) {
    logger.error({ err }, "Failed to reach container runtime");
    throw new Error("Container runtime is required but failed to start", {
      cause: err,
    });
  }
}

export function cleanupOrphans(): void {
  try {
    const output = execSync(
      `${CONTAINER_RUNTIME_BIN} ps --filter name=nagi- --format '{{.Names}}'`,
      { stdio: ["pipe", "pipe", "pipe"], encoding: "utf-8" },
    );
    const orphans = output.trim().split("\n").filter(Boolean);
    for (const name of orphans) {
      try {
        execSync(stopContainer(name), { stdio: "pipe" });
      } catch {
        /* already stopped */
      }
    }
    if (orphans.length > 0) {
      logger.info(
        { count: orphans.length, names: orphans },
        "Stopped orphaned containers",
      );
    }
  } catch (err) {
    logger.warn({ err }, "Failed to clean up orphaned containers");
  }
}
