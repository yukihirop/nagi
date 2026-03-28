import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLogger } from "@nagi/logger";
import type { AdditionalMount, AllowedRoot, MountAllowlist } from "@nagi/types";

const logger = createLogger({ name: "mount-security" });

const DEFAULT_BLOCKED_PATTERNS = [
  ".ssh",
  ".gnupg",
  ".gpg",
  ".aws",
  ".azure",
  ".gcloud",
  ".kube",
  ".docker",
  "credentials",
  ".env",
  ".netrc",
  ".npmrc",
  ".pypirc",
  "id_rsa",
  "id_ed25519",
  "private_key",
  ".secret",
];

function expandPath(p: string): string {
  const homeDir = process.env.HOME || os.homedir();
  if (p.startsWith("~/")) return path.join(homeDir, p.slice(2));
  if (p === "~") return homeDir;
  return path.resolve(p);
}

function getRealPath(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

function matchesBlockedPattern(
  realPath: string,
  blockedPatterns: string[],
): string | null {
  const pathParts = realPath.split(path.sep);
  for (const pattern of blockedPatterns) {
    for (const part of pathParts) {
      if (part === pattern || part.includes(pattern)) return pattern;
    }
    if (realPath.includes(pattern)) return pattern;
  }
  return null;
}

function findAllowedRoot(
  realPath: string,
  allowedRoots: AllowedRoot[],
): AllowedRoot | null {
  for (const root of allowedRoots) {
    const expandedRoot = expandPath(root.path);
    const realRoot = getRealPath(expandedRoot);
    if (realRoot === null) continue;
    const relative = path.relative(realRoot, realPath);
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) return root;
  }
  return null;
}

function isValidContainerPath(containerPath: string): boolean {
  if (containerPath.includes("..")) return false;
  if (containerPath.startsWith("/")) return false;
  if (!containerPath || containerPath.trim() === "") return false;
  return true;
}

export interface MountValidationResult {
  allowed: boolean;
  reason: string;
  realHostPath?: string;
  resolvedContainerPath?: string;
  effectiveReadonly?: boolean;
}

export function validateMount(
  mount: AdditionalMount,
  allowlist: MountAllowlist,
  isMain: boolean,
): MountValidationResult {
  const containerPath = mount.containerPath || path.basename(mount.hostPath);

  if (!isValidContainerPath(containerPath)) {
    return {
      allowed: false,
      reason: `Invalid container path: "${containerPath}" — must be relative, non-empty, no ".."`,
    };
  }

  const expandedPath = expandPath(mount.hostPath);
  const realPath = getRealPath(expandedPath);

  if (realPath === null) {
    return {
      allowed: false,
      reason: `Host path does not exist: "${mount.hostPath}" (expanded: "${expandedPath}")`,
    };
  }

  const mergedBlocked = [
    ...new Set([...DEFAULT_BLOCKED_PATTERNS, ...allowlist.blockedPatterns]),
  ];

  const blockedMatch = matchesBlockedPattern(realPath, mergedBlocked);
  if (blockedMatch !== null) {
    return {
      allowed: false,
      reason: `Path matches blocked pattern "${blockedMatch}": "${realPath}"`,
    };
  }

  const allowedRoot = findAllowedRoot(realPath, allowlist.allowedRoots);
  if (allowedRoot === null) {
    return {
      allowed: false,
      reason: `Path "${realPath}" is not under any allowed root. Allowed: ${allowlist.allowedRoots.map((r) => expandPath(r.path)).join(", ")}`,
    };
  }

  const requestedReadWrite = mount.readonly === false;
  let effectiveReadonly = true;

  if (requestedReadWrite) {
    if (!isMain && allowlist.nonMainReadOnly) {
      effectiveReadonly = true;
      logger.info({ mount: mount.hostPath }, "Mount forced to read-only for non-main group");
    } else if (!allowedRoot.allowReadWrite) {
      effectiveReadonly = true;
      logger.info({ mount: mount.hostPath, root: allowedRoot.path }, "Mount forced to read-only — root does not allow read-write");
    } else {
      effectiveReadonly = false;
    }
  }

  return {
    allowed: true,
    reason: `Allowed under root "${allowedRoot.path}"${allowedRoot.description ? ` (${allowedRoot.description})` : ""}`,
    realHostPath: realPath,
    resolvedContainerPath: containerPath,
    effectiveReadonly,
  };
}

export function validateAdditionalMounts(
  mounts: AdditionalMount[],
  allowlist: MountAllowlist,
  groupName: string,
  isMain: boolean,
): Array<{ hostPath: string; containerPath: string; readonly: boolean }> {
  const validated: Array<{
    hostPath: string;
    containerPath: string;
    readonly: boolean;
  }> = [];

  for (const mount of mounts) {
    const result = validateMount(mount, allowlist, isMain);

    if (result.allowed) {
      validated.push({
        hostPath: result.realHostPath!,
        containerPath: `/workspace/extra/${result.resolvedContainerPath}`,
        readonly: result.effectiveReadonly!,
      });
      logger.debug(
        { group: groupName, hostPath: result.realHostPath, readonly: result.effectiveReadonly },
        "Mount validated",
      );
    } else {
      logger.warn(
        { group: groupName, requestedPath: mount.hostPath, reason: result.reason },
        "Additional mount REJECTED",
      );
    }
  }

  return validated;
}
