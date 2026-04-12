import path from "node:path";
import os from "node:os";
import { NagiConfigSchema, type NagiConfig } from "./schema.js";
import { readEnvFile } from "./env.js";

export interface LoadConfigOverrides {
  projectRoot?: string;
  envPath?: string;
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

  // Read from .env file (not loaded into process.env)
  const envFile = readEnvFile(
    [
      "ASSISTANT_NAME",
      "ASSISTANT_HAS_OWN_NUMBER",
      "CONTAINER_IMAGE",
      "CONTAINER_TIMEOUT",
      "CONTAINER_MAX_OUTPUT_SIZE",
      "IDLE_TIMEOUT",
      "MAX_CONCURRENT_CONTAINERS",
      "CREDENTIAL_PROXY_PORT",
    ],
    overrides?.envPath,
  );

  const raw = {
    assistantName:
      overrides?.assistantName || envFile.ASSISTANT_NAME || process.env.ASSISTANT_NAME || undefined,
    assistantHasOwnNumber:
      overrides?.assistantHasOwnNumber ??
      parseEnvBoolean(envFile.ASSISTANT_HAS_OWN_NUMBER || process.env.ASSISTANT_HAS_OWN_NUMBER),
    timezone:
      overrides?.timezone || process.env.TZ || undefined,
    container: {
      image:
        overrides?.container?.image || envFile.CONTAINER_IMAGE || process.env.CONTAINER_IMAGE || undefined,
      timeout:
        overrides?.container?.timeout ??
        parseEnvNumber(envFile.CONTAINER_TIMEOUT || process.env.CONTAINER_TIMEOUT),
      maxOutputSize:
        overrides?.container?.maxOutputSize ??
        parseEnvNumber(envFile.CONTAINER_MAX_OUTPUT_SIZE || process.env.CONTAINER_MAX_OUTPUT_SIZE),
      idleTimeout:
        overrides?.container?.idleTimeout ??
        parseEnvNumber(envFile.IDLE_TIMEOUT || process.env.IDLE_TIMEOUT),
      maxConcurrent:
        overrides?.container?.maxConcurrent ??
        parseEnvNumber(envFile.MAX_CONCURRENT_CONTAINERS || process.env.MAX_CONCURRENT_CONTAINERS),
      credentialProxyPort:
        overrides?.container?.credentialProxyPort ??
        parseEnvNumber(envFile.CREDENTIAL_PROXY_PORT || process.env.CREDENTIAL_PROXY_PORT),
    },
    intervals: {
      poll: overrides?.intervals?.poll,
      schedulerPoll: overrides?.intervals?.schedulerPoll,
      ipcPoll: overrides?.intervals?.ipcPoll,
    },
    paths: {
      deployDir: "", // placeholder — set after parse from assistantName
      groupsDir: "", // placeholder — set after parse from assistantName
      dataDir: "", // placeholder — set after parse from assistantName
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

  // Resolve paths from assistantName
  config.paths.deployDir = path.join(projectRoot, "deploy", config.assistantName);
  config.paths.dataDir = path.join(projectRoot, "__data", config.assistantName);
  config.paths.groupsDir = path.join(config.paths.dataDir, "groups");

  return {
    ...config,
    triggerPattern: new RegExp(`^@${config.assistantName}\\b`, "i"),
  };
}
