/**
 * LLM provider ids and labels for the Settings UI.
 *
 * **Do not import `hoomanjs` in client components** — its barrel pulls Node-only
 * modules (MCP, tools, etc.) and breaks the Next.js browser bundle.
 *
 * Keep these string literals aligned with `LlmProvider` in Hooman's
 * `core/models/types.ts`.
 */
export const LLM_PROVIDER_OPTIONS = [
  "anthropic",
  "azure",
  "bedrock",
  "google",
  "groq",
  "minimax",
  "moonshot",
  "ollama",
  "openai",
  "openrouter",
  "xai",
] as const;

export type LlmProviderOption = (typeof LLM_PROVIDER_OPTIONS)[number];

export const LLM_PROVIDER_LABELS: Record<LlmProviderOption, string> = {
  anthropic: "Anthropic",
  azure: "Azure OpenAI",
  bedrock: "Bedrock",
  google: "Google",
  groq: "Groq",
  minimax: "MiniMax",
  moonshot: "Moonshot",
  ollama: "Ollama",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  xai: "xAI",
};

/**
 * Example provider `options` object per provider (aligned with Hooman's
 * `ProviderOptions` union). Providers now hold credentials/connection details;
 * named LLMs just reference a provider by name plus `model`/`temperature`/
 * `maxTokens`. Every provider also accepts an optional `reasoning` block
 * (`{ effort, summary?, display? }`) to enable extended thinking.
 */
export function exampleProviderOptionsForProvider(
  provider: LlmProviderOption,
): Record<string, unknown> {
  switch (provider) {
    case "ollama":
      return { baseURL: "http://localhost:11434" };
    case "openai":
      return { apiKey: "...", reasoning: { effort: "medium" } };
    case "azure":
      return {
        resourceName: "your-resource",
        apiKey: "...",
        apiVersion: "2025-01-01-preview",
        reasoning: { effort: "medium" },
      };
    case "openrouter":
      return { apiKey: "...", reasoning: { effort: "medium" } };
    case "minimax":
      return { apiKey: "...", reasoning: { effort: "medium" } };
    case "anthropic":
      return { apiKey: "...", reasoning: { effort: "medium" } };
    case "google":
      return { apiKey: "...", reasoning: { effort: "medium" } };
    case "bedrock":
      return {
        region: "us-east-1",
        reasoning: { effort: "medium" },
      };
    case "groq":
      return { apiKey: "...", reasoning: { effort: "medium" } };
    case "moonshot":
      return { apiKey: "...", reasoning: { effort: "medium" } };
    case "xai":
      return { apiKey: "...", reasoning: { effort: "medium" } };
  }
}

export function exampleProviderOptionsJson(
  provider: LlmProviderOption,
): string {
  return JSON.stringify(exampleProviderOptionsForProvider(provider), null, 2);
}

/** Reasoning effort levels shared across every reasoning-capable provider. */
export const REASONING_EFFORT_OPTIONS = [
  "minimal",
  "low",
  "medium",
  "high",
] as const;
export type ReasoningEffortOption = (typeof REASONING_EFFORT_OPTIONS)[number];
