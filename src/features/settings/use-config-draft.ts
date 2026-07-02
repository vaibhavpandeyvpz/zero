import { useEffect, useMemo, useRef, useState } from "react";
import type { ZeroConfigResponse } from "@/client/types";
import { LLM_PROVIDER_OPTIONS } from "./hooman-llm-providers";

export type AgentConfigDraft = ZeroConfigResponse["config"];
export type ProviderDraft = AgentConfigDraft["providers"][number];
export type LlmDraft = AgentConfigDraft["llms"][number];

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

function defaultProviderName(config: AgentConfigDraft): string {
  return config.providers[0]?.name ?? "";
}

export type ServerProviderBaseline = {
  provider: string;
  optionsText: string;
};

export function useConfigDraft(config: ZeroConfigResponse | null) {
  const [configDraft, setConfigDraft] = useState<AgentConfigDraft | null>(null);
  const [configErrors, setConfigErrors] = useState<string[]>([]);
  const [selectedProviderName, setSelectedProviderName] = useState("");
  const [providerOptionsText, setProviderOptionsText] = useState<
    Record<string, string>
  >({});
  const [selectedLlmName, setSelectedLlmName] = useState("");
  const [instructions, setInstructions] = useState("");

  const configRef = useRef(config);
  configRef.current = config;

  /** Last server snapshot per provider name (for restoring options when provider type matches saved). */
  const serverProviderBaselineRef = useRef<
    Record<string, ServerProviderBaseline>
  >({});

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
        setSelectedProviderName("");
        setProviderOptionsText({});
        setSelectedLlmName("");
        setInstructions("");
        serverProviderBaselineRef.current = {};
      }
      return;
    }
    const next = cloneConfig(latest.config);
    serverProviderBaselineRef.current = Object.fromEntries(
      next.providers.map((entry) => [
        entry.name,
        {
          provider: entry.provider,
          optionsText: JSON.stringify(entry.options ?? {}, null, 2),
        },
      ]),
    );
    setConfigDraft(next);
    setSelectedProviderName((prev) =>
      prev && next.providers.some((entry) => entry.name === prev)
        ? prev
        : defaultProviderName(next),
    );
    setProviderOptionsText(
      Object.fromEntries(
        next.providers.map((entry) => [
          entry.name,
          JSON.stringify(entry.options ?? {}, null, 2),
        ]),
      ),
    );
    setSelectedLlmName((prev) =>
      prev && next.llms.some((entry) => entry.name === prev)
        ? prev
        : defaultLlmName(next),
    );
    setInstructions(latest.instructions);
  }, [serverPayloadKey]);

  const providerTypes = useMemo(() => LLM_PROVIDER_OPTIONS, []);

  const selectedProvider = useMemo(
    () =>
      configDraft?.providers.find(
        (entry) => entry.name === selectedProviderName,
      ) ?? null,
    [configDraft, selectedProviderName],
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

  function setCurrentProviderOptionsText(value: string) {
    if (!selectedProviderName) {
      return;
    }
    setProviderOptionsText((current) => ({
      ...current,
      [selectedProviderName]: value,
    }));
  }

  function getServerProviderBaseline(
    name: string,
  ): ServerProviderBaseline | undefined {
    return serverProviderBaselineRef.current[name];
  }

  function parseProviderOptionsText(
    value: string,
    name: string,
  ): Record<string, unknown> {
    try {
      const parsed = JSON.parse(value || "{}") as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Provider options must be a JSON object.");
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `${name}: ${error.message}`
          : `Invalid provider options JSON for ${name}.`,
      );
    }
  }

  function parseAllProviders(): AgentConfigDraft["providers"] {
    if (!configDraft) {
      return [];
    }
    return configDraft.providers.map(
      (entry) =>
        ({
          ...entry,
          options: parseProviderOptionsText(
            providerOptionsText[entry.name] ?? "{}",
            entry.name,
          ),
        }) as ProviderDraft,
    );
  }

  function patchSelectedProvider(
    updater: (
      entry: NonNullable<typeof selectedProvider>,
    ) => NonNullable<typeof selectedProvider>,
  ) {
    if (!selectedProvider) {
      return;
    }
    updateDraft((draft) => ({
      ...draft,
      providers: draft.providers.map((entry) =>
        entry.name === selectedProvider.name ? updater(entry) : entry,
      ),
    }));
  }

  function addProvider() {
    if (!configDraft) {
      return;
    }
    const suffix = configDraft.providers.length + 1;
    let name = `Provider ${suffix}`;
    while (configDraft.providers.some((entry) => entry.name === name)) {
      name = `Provider ${Math.floor(Math.random() * 1000)}`;
    }
    updateDraft((draft) => ({
      ...draft,
      providers: [
        ...draft.providers,
        {
          name,
          provider: "ollama" as ProviderDraft["provider"],
          options: {},
        } as ProviderDraft,
      ],
    }));
    setProviderOptionsText((current) => ({
      ...current,
      [name]: JSON.stringify({}, null, 2),
    }));
    serverProviderBaselineRef.current = {
      ...serverProviderBaselineRef.current,
      [name]: { provider: "ollama", optionsText: JSON.stringify({}, null, 2) },
    };
    setSelectedProviderName(name);
  }

  function removeSelectedProvider() {
    if (
      !configDraft ||
      !selectedProvider ||
      configDraft.providers.length <= 1
    ) {
      return;
    }
    if (
      configDraft.llms.some((entry) => entry.provider === selectedProvider.name)
    ) {
      throw new Error(
        `Provider "${selectedProvider.name}" is used by one or more LLMs. Change or remove those LLMs first.`,
      );
    }
    const fallback =
      configDraft.providers.find(
        (entry) => entry.name !== selectedProvider.name,
      )?.name ?? "";
    updateDraft((draft) => ({
      ...draft,
      providers: draft.providers.filter(
        (entry) => entry.name !== selectedProvider.name,
      ),
    }));
    setProviderOptionsText((current) => {
      const next = { ...current };
      delete next[selectedProvider.name];
      return next;
    });
    const baselineNext = { ...serverProviderBaselineRef.current };
    delete baselineNext[selectedProvider.name];
    serverProviderBaselineRef.current = baselineNext;
    setSelectedProviderName(fallback);
  }

  function renameSelectedProvider(nextName: string) {
    if (!selectedProvider || !configDraft) {
      return;
    }
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === selectedProvider.name) {
      return;
    }
    if (configDraft.providers.some((entry) => entry.name === trimmed)) {
      throw new Error(`A provider named "${trimmed}" already exists.`);
    }
    const oldName = selectedProvider.name;
    updateDraft((draft) => ({
      ...draft,
      providers: draft.providers.map((entry) =>
        entry.name === oldName ? { ...entry, name: trimmed } : entry,
      ),
      llms: draft.llms.map((entry) =>
        entry.provider === oldName ? { ...entry, provider: trimmed } : entry,
      ),
    }));
    setProviderOptionsText((current) => {
      const next = { ...current, [trimmed]: current[oldName] ?? "{}" };
      delete next[oldName];
      return next;
    });
    const baseline = serverProviderBaselineRef.current[oldName];
    if (baseline !== undefined) {
      const baselineNext = { ...serverProviderBaselineRef.current };
      delete baselineNext[oldName];
      baselineNext[trimmed] = baseline;
      serverProviderBaselineRef.current = baselineNext;
    }
    setSelectedProviderName(trimmed);
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
          provider: defaultProviderName(draft),
          options: { model: "" },
          default: false,
        } as LlmDraft,
      ],
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
    providerOptionsText,
    selectedProviderName,
    selectedProvider,
    providerTypes,
    selectedLlmName,
    selectedLlm,
    setConfigDraft,
    setConfigErrors,
    setInstructions,
    setSelectedProviderName,
    setSelectedLlmName,
    setCurrentProviderOptionsText,
    getServerProviderBaseline,
    updateDraft,
    updateToolToggle,
    patchSelectedProvider,
    patchSelectedLlm,
    parseAllProviders,
    addProvider,
    removeSelectedProvider,
    renameSelectedProvider,
    addLlm,
    removeSelectedLlm,
    renameSelectedLlm,
    setDefaultLlm,
  };
}
