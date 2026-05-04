import type { McpServerView } from "@/client/types";

type McpTransportDraft = McpServerView["transport"];
type McpTransportType = McpTransportDraft["type"];

export const LLM_PROVIDER_LABELS = {
  anthropic: "Anthropic",
  google: "Google",
  groq: "Groq",
  moonshot: "Moonshot",
  openai: "OpenAI",
  ollama: "Ollama",
  bedrock: "Bedrock",
  xai: "xAI",
} as const;

export const SEARCH_PROVIDER_LABELS = {
  brave: "Brave",
  serper: "Serper",
  tavily: "Tavily",
} as const;

export const PROMPT_LABELS = {
  behaviour: "Behaviour",
  communication: "Communication",
  execution: "Execution",
  guardrails: "Guardrails",
} as const;

export const TOOL_LABELS = {
  todo: "Todo",
  fetch: "Fetch",
  filesystem: "Filesystem",
  shell: "Shell",
  sleep: "Sleep",
} as const;

export const MCP_CONNECTION_LABELS = {
  stdio: "Local command",
  "streamable-http": "Remote server",
  sse: "Event stream",
} satisfies Record<McpTransportType, string>;
