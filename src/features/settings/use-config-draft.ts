import { useEffect, useMemo, useRef, useState } from "react";
import type { ZeroConfigResponse } from "@/client/types";

export type AgentConfigDraft = ZeroConfigResponse["config"];

function cloneConfig(config: AgentConfigDraft): AgentConfigDraft {
  return JSON.parse(JSON.stringify(config)) as AgentConfigDraft;
}

function defaultLlmName(config: AgentConfigDraft): string {
  return (
    config.llms.find((entry) => entry.default)?.name ??
    config.llms[0]?.name ??
    ""
  );
}

export function useConfigDraft(config: ZeroConfigResponse | null) {
  const [configDraft, setConfigDraft] = useState<AgentConfigDraft | null>(null);
  const [configErrors, setConfigErrors] = useState<string[]>([]);
  const [selectedLlmName, setSelectedLlmName] = useState("");
  const [llmParamsText, setLlmParamsText] = useState<Record<string, string>>(
    {},
  );
  const [instructions, setInstructions] = useState("");

  const configRef = useRef(config);
  configRef.current = config;

  /** Stable identity for server payload so reference churn on `config` does not reset local draft state. */
  const serverPayloadKey = useMemo(() => {
    if (!config) return "";
    return JSON.stringify({
      cfg: config.config,
      instructions: config.instructions,
    });
  }, [config]);

  useEffect(() => {
    const latest = configRef.current;
    if (!serverPayloadKey || !latest) {
      if (!latest) {
        setConfigDraft(null);
        setSelectedLlmName("");
        setLlmParamsText({});
        setInstructions("");
      }
      return;
    }
    const next = cloneConfig(latest.config);
    setConfigDraft(next);
    setSelectedLlmName((prev) =>
      prev && next.llms.some((entry) => entry.name === prev)
        ? prev
        : defaultLlmName(next),
    );
    setLlmParamsText(
      Object.fromEntries(
        next.llms.map((entry) => [
          entry.name,
          JSON.stringify(entry.options.params ?? {}, null, 2),
        ]),
      ),
    );
    setInstructions(latest.instructions);
  }, [serverPayloadKey]);

  const providers = useMemo(
    () =>
      [
        "anthropic",
        "google",
        "groq",
        "moonshot",
        "openai",
        "ollama",
        "bedrock",
        "xai",
      ] as const,
    [],
  );

  const selectedLlm = useMemo(
    () =>
      configDraft?.llms.find((entry) => entry.name === selectedLlmName) ?? null,
    [configDraft, selectedLlmName],
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

  function setCurrentLlmParamsText(value: string) {
    if (!selectedLlmName) {
      return;
    }
    setLlmParamsText((current) => ({ ...current, [selectedLlmName]: value }));
  }

  function parseLlmParamsText(
    value: string,
    name: string,
  ): Record<string, unknown> {
    try {
      const parsed = JSON.parse(value || "{}") as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("LLM params must be a JSON object.");
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `${name}: ${error.message}`
          : `Invalid LLM params JSON for ${name}.`,
      );
    }
  }

  function parseAllLlmParams() {
    if (!configDraft) {
      return [];
    }
    return configDraft.llms.map((entry) => ({
      ...entry,
      options: {
        ...entry.options,
        params: parseLlmParamsText(
          llmParamsText[entry.name] ?? "{}",
          entry.name,
        ),
      },
    }));
  }

  function patchSelectedLlm(
    updater: (
      entry: NonNullable<typeof selectedLlm>,
    ) => NonNullable<typeof selectedLlm>,
  ) {
    if (!selectedLlm) {
      return;
    }
    updateDraft((draft) => ({
      ...draft,
      llms: draft.llms.map((entry) =>
        entry.name === selectedLlm.name ? updater(entry) : entry,
      ),
    }));
  }

  function addLlm() {
    if (!configDraft) {
      return;
    }
    const suffix = configDraft.llms.length + 1;
    let name = `Model ${suffix}`;
    while (configDraft.llms.some((entry) => entry.name === name)) {
      name = `Model ${Math.floor(Math.random() * 1000)}`;
    }
    updateDraft((draft) => ({
      ...draft,
      llms: [
        ...draft.llms,
        {
          name,
          options: {
            provider:
              "ollama" as AgentConfigDraft["llms"][number]["options"]["provider"],
            model: "gemma4:e4b",
            params: {},
          },
          default: false,
        },
      ],
    }));
    setLlmParamsText((current) => ({
      ...current,
      [name]: JSON.stringify({}, null, 2),
    }));
    setSelectedLlmName(name);
  }

  function removeSelectedLlm() {
    if (!configDraft || !selectedLlm || configDraft.llms.length <= 1) {
      return;
    }
    const fallback =
      configDraft.llms.find((entry) => entry.name !== selectedLlm.name)?.name ??
      "";
    updateDraft((draft) => ({
      ...draft,
      llms: draft.llms
        .filter((entry) => entry.name !== selectedLlm.name)
        .map((entry, index) => ({
          ...entry,
          default:
            entry.default || selectedLlm.default ? index === 0 : entry.default,
        })),
    }));
    setLlmParamsText((current) => {
      const next = { ...current };
      delete next[selectedLlm.name];
      return next;
    });
    setSelectedLlmName(fallback);
  }

  function renameSelectedLlm(nextName: string) {
    if (!selectedLlm || !configDraft) {
      return;
    }
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === selectedLlm.name) {
      return;
    }
    if (configDraft.llms.some((entry) => entry.name === trimmed)) {
      throw new Error(`An LLM named "${trimmed}" already exists.`);
    }
    updateDraft((draft) => ({
      ...draft,
      llms: draft.llms.map((entry) =>
        entry.name === selectedLlm.name ? { ...entry, name: trimmed } : entry,
      ),
    }));
    setLlmParamsText((current) => {
      const next = { ...current, [trimmed]: current[selectedLlm.name] ?? "{}" };
      delete next[selectedLlm.name];
      return next;
    });
    setSelectedLlmName(trimmed);
  }

  function setDefaultLlm(name: string) {
    updateDraft((draft) => ({
      ...draft,
      llms: draft.llms.map((entry) => ({
        ...entry,
        default: entry.name === name,
      })),
    }));
  }

  return {
    configDraft,
    configErrors,
    instructions,
    llmParamsText,
    selectedLlmName,
    selectedLlm,
    providers,
    setConfigDraft,
    setConfigErrors,
    setInstructions,
    setSelectedLlmName,
    setCurrentLlmParamsText,
    updateDraft,
    updateToolToggle,
    patchSelectedLlm,
    parseAllLlmParams,
    addLlm,
    removeSelectedLlm,
    renameSelectedLlm,
    setDefaultLlm,
  };
}
