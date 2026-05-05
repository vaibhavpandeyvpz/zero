/**
 * LLM provider ids and labels for the Settings UI.
 *
 * **Do not import `hoomanjs` in client components** — its barrel pulls Node-only
 * modules (MCP, tools, etc.) and breaks the Next.js browser bundle.
 *
 * Keep these string literals aligned with `LlmProvider` in Hooman’s `config.ts`.
 */
export const LLM_PROVIDER_OPTIONS = [
  "anthropic",
  "bitfrost",
  "google",
  "groq",
  "moonshot",
  "openai",
  "tensorzero",
  "ollama",
  "bedrock",
  "xai",
] as const;

export type LlmProviderOption = (typeof LLM_PROVIDER_OPTIONS)[number];

export const LLM_PROVIDER_LABELS: Record<LlmProviderOption, string> = {
  anthropic: "Anthropic",
  bitfrost: "Bitfrost",
  google: "Google",
  groq: "Groq",
  moonshot: "Moonshot",
  openai: "OpenAI",
  tensorzero: "TensorZero",
  ollama: "Ollama",
  bedrock: "Bedrock",
  xai: "xAI",
};
