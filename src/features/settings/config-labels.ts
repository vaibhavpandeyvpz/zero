import type { McpServerView } from "@/client/types";

export {
  LLM_PROVIDER_LABELS,
  LLM_PROVIDER_OPTIONS,
  type LlmProviderOption,
} from "./hooman-llm-providers";

type McpTransportDraft = McpServerView["transport"];
type McpTransportType = McpTransportDraft["type"];

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
