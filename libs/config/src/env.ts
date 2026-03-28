import fs from "node:fs";
import path from "node:path";

/**
 * Read specific keys from a .env file without polluting process.env.
 * Returns only the requested keys that exist in the file.
 */
export function readEnvFile(
  keys: string[],
  envPath?: string,
): Record<string, string> {
  const filePath = envPath ?? path.join(process.cwd(), ".env");
  const result: Record<string, string> = {};

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const keySet = new Set(keys);

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      if (!keySet.has(key)) continue;

      let value = trimmed.slice(eqIndex + 1).trim();
      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  } catch {
    // File not found or unreadable — return empty
  }

  return result;
}
