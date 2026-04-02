import path from "node:path";

const GROUP_FOLDER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const CHANNEL_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const RESERVED_FOLDERS = new Set(["global"]);

export function isValidChannel(channel: string): boolean {
  if (!channel) return false;
  if (channel !== channel.trim()) return false;
  if (!CHANNEL_PATTERN.test(channel)) return false;
  if (channel.includes("/") || channel.includes("\\")) return false;
  if (channel.includes("..")) return false;
  return true;
}

export function isValidGroupFolder(folder: string): boolean {
  if (!folder) return false;
  if (folder !== folder.trim()) return false;
  if (!GROUP_FOLDER_PATTERN.test(folder)) return false;
  if (folder.includes("/") || folder.includes("\\")) return false;
  if (folder.includes("..")) return false;
  if (RESERVED_FOLDERS.has(folder.toLowerCase())) return false;
  return true;
}

export function assertValidChannel(channel: string): void {
  if (!isValidChannel(channel)) {
    throw new Error(`Invalid channel "${channel}"`);
  }
}

export function assertValidGroupFolder(folder: string): void {
  if (!isValidGroupFolder(folder)) {
    throw new Error(`Invalid group folder "${folder}"`);
  }
}

function ensureWithinBase(baseDir: string, resolvedPath: string): void {
  const rel = path.relative(baseDir, resolvedPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes base directory: ${resolvedPath}`);
  }
}

export function resolveGroupFolderPath(
  groupsDir: string,
  channel: string,
  folder: string,
): string {
  assertValidChannel(channel);
  assertValidGroupFolder(folder);
  const groupPath = path.resolve(groupsDir, channel, folder);
  ensureWithinBase(groupsDir, groupPath);
  return groupPath;
}

export function resolveGroupIpcPath(
  dataDir: string,
  channel: string,
  folder: string,
): string {
  assertValidChannel(channel);
  assertValidGroupFolder(folder);
  const ipcBaseDir = path.resolve(dataDir, "ipc");
  const ipcPath = path.resolve(ipcBaseDir, channel, folder);
  ensureWithinBase(ipcBaseDir, ipcPath);
  return ipcPath;
}
