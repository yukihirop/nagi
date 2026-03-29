import type { OpencodeClient } from "@opencode-ai/sdk";

export interface ToolInfo {
  toolName: string;
  toolInput: Record<string, unknown>;
}

type ToolInputExtractor = (part: Record<string, unknown>) => Record<string, unknown>;

/**
 * Provider-specific extractors for tool input from Open Code message parts.
 * Each provider structures tool call data differently.
 */
const TOOL_INPUT_EXTRACTORS: Record<string, ToolInputExtractor> = {
  google: (part) => {
    // Google/Gemini: tool input is in state.input
    const state = part.state as Record<string, unknown> | undefined;
    return (state?.input ?? {}) as Record<string, unknown>;
  },
  anthropic: (part) => {
    // Anthropic: tool input is in metadata.args or metadata.input
    const metadata = part.metadata as Record<string, unknown> | undefined;
    return (metadata?.args ?? metadata?.input ?? {}) as Record<string, unknown>;
  },
  openai: (part) => {
    const metadata = part.metadata as Record<string, unknown> | undefined;
    return (metadata?.args ?? metadata?.input ?? {}) as Record<string, unknown>;
  },
};

const DEFAULT_EXTRACTOR: ToolInputExtractor = (part) => {
  const state = part.state as Record<string, unknown> | undefined;
  const metadata = part.metadata as Record<string, unknown> | undefined;
  return (state?.input ?? metadata?.args ?? metadata?.input ?? {}) as Record<string, unknown>;
};

/**
 * Extract tool name and input from an Open Code message part.
 * Delegates to provider-specific extractors based on the current model.
 */
export function extractToolInfo(part: Record<string, unknown>, providerID: string): ToolInfo | null {
  if (part.type !== "tool" || !part.tool) return null;

  const extractor = TOOL_INPUT_EXTRACTORS[providerID] ?? DEFAULT_EXTRACTOR;
  return {
    toolName: part.tool as string,
    toolInput: extractor(part),
  };
}

// --- Cost extraction (provider-specific) ---

export interface CostInfo {
  cost: number;
  tokens: { input: number; output: number };
}

type CostExtractor = (assistantMsgs: Array<Record<string, unknown>>) => CostInfo | null;

/**
 * Provider-specific cost extractors.
 * Only supported providers are listed; unsupported ones return null.
 */
const COST_EXTRACTORS: Record<string, CostExtractor> = {
  google: (msgs) => {
    // Google/Gemini: info.cost, info.tokens.{input,output}
    let cost = 0;
    let input = 0;
    let output = 0;
    for (const m of msgs) {
      const info = m.info as Record<string, unknown> | undefined;
      cost += (info?.cost as number) ?? 0;
      const t = info?.tokens as Record<string, number> | undefined;
      if (t) {
        input += t.input ?? 0;
        output += t.output ?? 0;
      }
    }
    if (cost === 0 && input === 0) return null;
    return { cost, tokens: { input, output } };
  },
};

/**
 * Extract cost/token info from assistant messages.
 * Returns null for unsupported providers.
 */
export function extractCostInfo(
  assistantMsgs: Array<Record<string, unknown>>,
  providerID: string,
): CostInfo | null {
  const extractor = COST_EXTRACTORS[providerID];
  if (!extractor) return null;
  return extractor(assistantMsgs);
}

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
