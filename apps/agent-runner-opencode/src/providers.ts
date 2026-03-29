import type { OpencodeClient } from "@opencode-ai/sdk";

const PROVIDER_ENV_KEYS: Record<string, string> = {
  openrouter: "OPENROUTER_API_KEY",
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

/**
 * Extract provider ID from model string (e.g. "openrouter/google/gemini-2.5-pro" → "openrouter")
 */
export function getProviderID(model: string): string {
  return model.split("/")[0];
}

/**
 * Set the API key for the provider via Open Code client.
 * Returns true if key was set, false if no key found.
 */
export async function setProviderAuth(
  client: OpencodeClient,
  model: string,
  log: (msg: string) => void,
): Promise<boolean> {
  const providerID = getProviderID(model);
  const envKey = PROVIDER_ENV_KEYS[providerID];
  const apiKey = envKey ? process.env[envKey] : undefined;

  if (apiKey) {
    await client.auth.set({
      path: { id: providerID },
      body: { type: "api" as const, key: apiKey },
    });
    log(`API key set for provider: ${providerID}`);
    return true;
  }

  log(`Warning: No API key found for provider ${providerID} (expected env: ${envKey ?? "unknown"})`);
  return false;
}
