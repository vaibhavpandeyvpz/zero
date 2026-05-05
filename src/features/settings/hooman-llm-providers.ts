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
  "bifrost",
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
  bifrost: "Bifrost",
  google: "Google",
  groq: "Groq",
  moonshot: "Moonshot",
  openai: "OpenAI",
  tensorzero: "TensorZero",
  ollama: "Ollama",
  bedrock: "Bedrock",
  xai: "xAI",
};

/** Example `params` object per provider (aligned with Hooman README). */
export function exampleLlmParamsForProvider(
  provider: LlmProviderOption,
): Record<string, unknown> {
  switch (provider) {
    case "ollama":
      return {};
    case "openai":
      return { apiKey: "..." };
    case "bifrost":
      return {
        apiKey: "dummy-key",
        clientConfig: {
          baseURL: "http://localhost:8080",
        },
      };
    case "tensorzero":
      return {
        apiKey: "your-tensorzero-or-gateway-key",
        clientConfig: {
          baseURL: "http://localhost:3000/openai/v1",
        },
        params: {
          "tensorzero::tags": {
            user_id: "your-stable-user-or-tenant-id",
          },
        },
      };
    case "anthropic":
      return {
        apiKey: "...",
        temperature: 0.7,
      };
    case "google":
      return {
        apiKey: "...",
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.9,
        topK: 40,
      };
    case "bedrock":
      return {
        region: "us-east-1",
        clientConfig: {
          profile: "dev",
          maxAttempts: 3,
        },
        temperature: 0.7,
        maxTokens: 1024,
      };
    case "groq":
      return {
        apiKey: "...",
        temperature: 0.7,
      };
    case "moonshot":
      return {
        apiKey: "...",
        temperature: 0.7,
      };
    case "xai":
      return {
        apiKey: "...",
        temperature: 0.7,
      };
  }
}

export function exampleLlmParamsJson(provider: LlmProviderOption): string {
  return JSON.stringify(exampleLlmParamsForProvider(provider), null, 2);
}
