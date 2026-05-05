import { useEffect, useMemo, useRef, useState } from "react";
import type { ZeroConfigResponse } from "@/client/types";
import { LLM_PROVIDER_OPTIONS } from "./hooman-llm-providers";

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

export type ServerLlmBaseline = {
  provider: string;
  paramsText: string;
};

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

  /** Last server snapshot per LLM name (for restoring params when provider matches saved). */
  const serverLlmBaselineRef = useRef<Record<string, ServerLlmBaseline>>({});

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
        serverLlmBaselineRef.current = {};
      }
      return;
    }
    const next = cloneConfig(latest.config);
    serverLlmBaselineRef.current = Object.fromEntries(
      next.llms.map((entry) => [
        entry.name,
        {
          provider: entry.options.provider,
          paramsText: JSON.stringify(entry.options.params ?? {}, null, 2),
        },
      ]),
    );
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

  const providers = useMemo(() => LLM_PROVIDER_OPTIONS, []);

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

  function getServerLlmBaseline(name: string): ServerLlmBaseline | undefined {
    return serverLlmBaselineRef.current[name];
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
    serverLlmBaselineRef.current = {
      ...serverLlmBaselineRef.current,
      [name]: {
        provider: "ollama",
        paramsText: JSON.stringify({}, null, 2),
      },
    };
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
    const baselineNext = { ...serverLlmBaselineRef.current };
    delete baselineNext[selectedLlm.name];
    serverLlmBaselineRef.current = baselineNext;
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
    const baseline = serverLlmBaselineRef.current[selectedLlm.name];
    if (baseline !== undefined) {
      const baselineNext = { ...serverLlmBaselineRef.current };
      delete baselineNext[selectedLlm.name];
      baselineNext[trimmed] = baseline;
      serverLlmBaselineRef.current = baselineNext;
    }
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
    getServerLlmBaseline,
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
