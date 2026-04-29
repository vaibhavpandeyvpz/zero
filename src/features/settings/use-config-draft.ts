import { useEffect, useMemo, useState } from "react";
import type { ZeroConfigResponse } from "@/client/types";

export type AgentConfigDraft = ZeroConfigResponse["config"];

export function useConfigDraft(config: ZeroConfigResponse | null) {
  const [configDraft, setConfigDraft] = useState<AgentConfigDraft | null>(null);
  const [configErrors, setConfigErrors] = useState<string[]>([]);
  const [llmParamsText, setLlmParamsText] = useState("{}");
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (config) {
      setConfigDraft(JSON.parse(JSON.stringify(config.config)) as AgentConfigDraft);
      setLlmParamsText(JSON.stringify(config.config.llm.params ?? {}, null, 2));
      setInstructions(config.instructions);
    }
  }, [config]);

  const providers = useMemo(
    () => ["anthropic", "google", "groq", "moonshot", "openai", "ollama", "bedrock", "xai"] as const,
    [],
  );

  function updateDraft(updater: (draft: AgentConfigDraft) => AgentConfigDraft) {
    setConfigErrors([]);
    setConfigDraft((current) => (current ? updater(current) : current));
  }

  function updateToolToggle(
    tool: "todo" | "fetch" | "filesystem" | "shell" | "sleep",
    enabled: boolean,
  ) {
    updateDraft((draft) => ({
      ...draft,
      tools: {
        ...draft.tools,
        [tool]: { enabled },
      },
    }));
  }

  function parseLlmParams(): Record<string, unknown> {
    try {
      const value = JSON.parse(llmParamsText || "{}") as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("LLM params must be a JSON object.");
      }
      return value as Record<string, unknown>;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Invalid LLM params JSON.",
      );
    }
  }

  return {
    configDraft,
    configErrors,
    instructions,
    llmParamsText,
    providers,
    setConfigDraft,
    setConfigErrors,
    setInstructions,
    setLlmParamsText,
    updateDraft,
    updateToolToggle,
    parseLlmParams,
  };
}
