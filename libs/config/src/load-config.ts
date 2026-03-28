import path from "node:path";
import os from "node:os";
import { NagiConfigSchema, type NagiConfig } from "./schema.js";

export interface LoadConfigOverrides {
  projectRoot?: string;
  assistantName?: string;
  assistantHasOwnNumber?: boolean;
  timezone?: string;
  container?: Partial<NagiConfig["container"]>;
  intervals?: Partial<NagiConfig["intervals"]>;
}

export interface ResolvedConfig extends NagiConfig {
  triggerPattern: RegExp;
}

function parseEnvNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

function parseEnvBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") return undefined;
  return value === "true" || value === "1";
}

export function loadConfig(overrides?: LoadConfigOverrides): ResolvedConfig {
  const projectRoot = overrides?.projectRoot ?? process.cwd();
  const homeDir = os.homedir();

  const raw = {
    assistantName:
      overrides?.assistantName || process.env.ASSISTANT_NAME || undefined,
    assistantHasOwnNumber:
      overrides?.assistantHasOwnNumber ??
      parseEnvBoolean(process.env.ASSISTANT_HAS_OWN_NUMBER),
    timezone:
      overrides?.timezone || process.env.TZ || undefined,
    container: {
      image:
        overrides?.container?.image || process.env.CONTAINER_IMAGE || undefined,
      timeout:
        overrides?.container?.timeout ??
        parseEnvNumber(process.env.CONTAINER_TIMEOUT),
      maxOutputSize:
        overrides?.container?.maxOutputSize ??
        parseEnvNumber(process.env.CONTAINER_MAX_OUTPUT_SIZE),
      idleTimeout:
        overrides?.container?.idleTimeout ??
        parseEnvNumber(process.env.IDLE_TIMEOUT),
      maxConcurrent:
        overrides?.container?.maxConcurrent ??
        parseEnvNumber(process.env.MAX_CONCURRENT_CONTAINERS),
      credentialProxyPort:
        overrides?.container?.credentialProxyPort ??
        parseEnvNumber(process.env.CREDENTIAL_PROXY_PORT),
    },
    intervals: {
      poll: overrides?.intervals?.poll,
      schedulerPoll: overrides?.intervals?.schedulerPoll,
      ipcPoll: overrides?.intervals?.ipcPoll,
    },
    paths: {
      storeDir: path.join(projectRoot, "store"),
      groupsDir: path.join(projectRoot, "groups"),
      dataDir: path.join(projectRoot, "data"),
      mountAllowlistPath: path.join(
        homeDir,
        ".config",
        "nagi",
        "mount-allowlist.json",
      ),
      senderAllowlistPath: path.join(
        homeDir,
        ".config",
        "nagi",
        "sender-allowlist.json",
      ),
    },
  };

  const config = NagiConfigSchema.parse(raw);

  return {
    ...config,
    triggerPattern: new RegExp(`^@${config.assistantName}\\b`, "i"),
  };
}
