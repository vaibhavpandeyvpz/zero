"use client";

import { useEffect, useId, useState } from "react";
import {
  BotIcon,
  CheckIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SparklesIcon,
  SunIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  addMcp,
  installSkill,
  removeMcp,
  removeSkill,
  restartServices,
  saveConfig,
  searchSkills,
  updateMcp,
} from "@/client/api";
import type {
  McpServerView,
  SkillSearchResponse,
  SkillsResponse,
  ZeroConfigResponse,
} from "@/client/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ChatPanel } from "@/features/chat/chat-panel";
import {
  LLM_PROVIDER_LABELS,
  MCP_CONNECTION_LABELS,
  PROMPT_LABELS,
  SEARCH_PROVIDER_LABELS,
  TOOL_LABELS,
} from "@/features/settings/config-labels";
import {
  configErrorMessages,
  skillFolder,
} from "@/features/settings/form-utils";
import { KeyValueEditor } from "@/features/settings/key-value-editor";
import { ToggleRow } from "@/features/settings/toggle-row";
import { useConfigDraft } from "@/features/settings/use-config-draft";
import {
  useMcpDialog,
  type McpTransportType,
} from "@/features/settings/use-mcp-dialog";
import { useSkillInstallFlow } from "@/features/settings/use-skill-install-flow";
import { useZeroData } from "@/features/app/use-zero-data";
import { useChatSession } from "@/features/chat/use-chat-session";

export function ZeroShell() {
  const [activeTab, setActiveTab] = useState("chat");
  const [skillResults, setSkillResults] = useState<
    SkillSearchResponse["results"]
  >([]);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const chat = useChatSession();

  const running = chat.session?.running ?? false;
  const queued = (chat.session?.queued.length ?? 0) > 0;
  const approvals = Boolean(chat.session?.approvals);
  const data = useZeroData({ running, queued, approvals });
  const daemon = data.health?.daemonStatus;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex min-h-screen flex-col"
    >
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              size="icon-lg"
              type="button"
              aria-label="Go to chat"
              onClick={() => setActiveTab("chat")}
              className="rounded-xl bg-gradient-to-br from-violet-500 via-purple-600 to-teal-500 text-white shadow-sm ring-1 ring-white/25 hover:brightness-105 active:brightness-95 dark:from-violet-600 dark:via-purple-700 dark:to-teal-600"
            >
              <BotIcon />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate font-semibold leading-none">Zero</h1>
              <p className="truncate text-sm text-muted-foreground">
                Powered by{" "}
                <a
                  className="underline-offset-4 hover:underline"
                  href="https://github.com/vaibhavpandeyvpz/hooman"
                  target="_blank"
                  rel="noreferrer"
                >
                  Hooman
                </a>
              </p>
            </div>
          </div>

          <TabsList>
            <TabsTrigger value="chat">
              <SparklesIcon />
              Chat
            </TabsTrigger>
            <TabsTrigger value="settings">
              <SettingsIcon />
              Settings
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {mounted && theme === "dark" ? <SunIcon /> : <MoonIcon />}
              Theme
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-4">
        <TabsContent
          value="chat"
          className="mt-0 flex h-[calc(100vh-6rem)] min-h-0 flex-col gap-4"
        >
          <ChatPanel
            session={chat.session}
            agentName={data.config?.config.name ?? "Agent"}
            input={chat.input}
            setInput={chat.setInput}
            attachments={chat.attachments}
            uploadingAttachments={chat.uploadingAttachments}
            onAddAttachments={chat.addAttachmentFiles}
            onRemoveAttachment={chat.removeAttachment}
            daemon={daemon}
            onSubmit={chat.submitMessage}
            onCancel={chat.cancel}
            onSetModel={chat.setModel}
            sessionMode={chat.session?.sessionMode ?? "default"}
            onSetSessionMode={chat.setSessionMode}
            yolo={chat.session?.yolo ?? false}
            onSetYolo={chat.setYolo}
            onToggleDaemon={data.toggleDaemon}
            onApprove={chat.approve}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <SettingsPanel
            config={data.config}
            mcp={data.mcp}
            skills={data.skills}
            skillResults={skillResults}
            busy={data.busy}
            setBusy={data.setBusy}
            setConfig={data.setConfig}
            setMcp={data.setMcp}
            setSkills={data.setSkills}
            setSkillResults={setSkillResults}
            refreshAll={data.refreshAll}
          />
        </TabsContent>
      </main>
    </Tabs>
  );
}

function SettingsPanel(props: {
  config: ZeroConfigResponse | null;
  mcp: McpServerView[];
  skills: SkillsResponse["skills"];
  skillResults: SkillSearchResponse["results"];
  busy: boolean;
  setBusy: (value: boolean) => void;
  setConfig: (config: ZeroConfigResponse) => void;
  setMcp: (mcp: McpServerView[]) => void;
  setSkills: (skills: SkillsResponse["skills"]) => void;
  setSkillResults: (results: SkillSearchResponse["results"]) => void;
  refreshAll: () => Promise<void>;
}) {
  const defaultSessionsCheckboxId = useId();
  const {
    configDraft,
    configErrors,
    instructions,
    llmParamsText,
    selectedLlmName,
    selectedLlm,
    providers,
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
  } = useConfigDraft(props.config);
  const mcpDialog = useMcpDialog();
  const skillsFlow = useSkillInstallFlow({
    setSkillResults: props.setSkillResults,
  });
  const {
    mcpDialogOpen,
    mcpName,
    mcpEditingName,
    mcpType,
    mcpCommand,
    mcpEnvEntries,
    mcpCwd,
    mcpUrl,
    mcpHeaderEntries,
    setMcpDialogOpen,
    setMcpName,
    setMcpType,
    setMcpCommand,
    setMcpEnvEntries,
    setMcpCwd,
    setMcpUrl,
    setMcpHeaderEntries,
    resetMcpForm,
    startAddMcpServer,
    editMcpServer,
    buildMcpTransport,
  } = mcpDialog;
  const {
    skillDialogOpen,
    skillInstallCandidate,
    skillQuery,
    skillSource,
    setSkillDialogOpen,
    setSkillInstallCandidate,
    setSkillQuery,
    setSkillSource,
    clearSkillInstallState,
    requestSkillInstall,
    submitSkillSourceInstall,
  } = skillsFlow;

  async function runTask(task: () => Promise<void>, success: string) {
    props.setBusy(true);
    try {
      await task();
      toast.success(success);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      props.setBusy(false);
    }
  }

  function submitSkillSearch() {
    void runTask(async () => {
      const data = await searchSkills(skillsFlow.skillQuery);
      props.setSkillResults(data.results);
    }, "Skill search complete.");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Agent configuration</CardTitle>
          <CardDescription>
            Web version of the core configure screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {configDraft ? (
            <Tabs defaultValue="general" className="flex flex-col gap-4">
              <div className="overflow-x-auto overflow-y-hidden pb-1">
                <TabsList variant="line">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="llm">LLM</TabsTrigger>
                  <TabsTrigger value="search">Search</TabsTrigger>
                  <TabsTrigger value="prompts">Prompts</TabsTrigger>
                  <TabsTrigger value="tools">Tools</TabsTrigger>
                  <TabsTrigger value="memory">Memory</TabsTrigger>
                  <TabsTrigger value="agents">Subagents</TabsTrigger>
                  <TabsTrigger value="compaction">Compaction</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="general" className="mt-0 flex flex-col gap-4">
                <Field>
                  <FieldLabel>Agent name</FieldLabel>
                  <Input
                    value={configDraft.name}
                    onChange={(event) =>
                      updateDraft((draft) => ({
                        ...draft,
                        name: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Instructions</FieldLabel>
                  <Textarea
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                  />
                </Field>
              </TabsContent>

              <TabsContent value="llm" className="mt-0 flex flex-col gap-4">
                <div className="flex flex-wrap items-end gap-3">
                  <Field className="min-w-64 flex-1">
                    <FieldLabel>Named LLM</FieldLabel>
                    <Select
                      value={selectedLlmName}
                      onValueChange={setSelectedLlmName}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an LLM" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {configDraft.llms.map((entry) => (
                            <SelectItem key={entry.name} value={entry.name}>
                              {entry.name}
                              {entry.default ? " • default" : ""}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Button type="button" variant="outline" onClick={addLlm}>
                    <PlusIcon />
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!selectedLlm || configDraft.llms.length <= 1}
                    onClick={removeSelectedLlm}
                  >
                    Remove
                  </Button>
                </div>
                {selectedLlm ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field>
                        <FieldLabel>Name</FieldLabel>
                        <Input
                          value={selectedLlm.name}
                          onChange={(event) => {
                            try {
                              renameSelectedLlm(event.target.value);
                            } catch (error) {
                              setConfigErrors([(error as Error).message]);
                            }
                          }}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Provider</FieldLabel>
                        <Select
                          value={selectedLlm.options.provider}
                          onValueChange={(value) =>
                            patchSelectedLlm((entry) => ({
                              ...entry,
                              options: {
                                ...entry.options,
                                provider: value as never,
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {providers.map((item) => (
                                <SelectItem key={item} value={item}>
                                  {LLM_PROVIDER_LABELS[item]}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>Model</FieldLabel>
                        <Input
                          value={selectedLlm.options.model}
                          onChange={(event) =>
                            patchSelectedLlm((entry) => ({
                              ...entry,
                              options: {
                                ...entry.options,
                                model: event.target.value,
                              },
                            }))
                          }
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel>LLM params</FieldLabel>
                      <Textarea
                        className="min-h-32 font-mono"
                        value={llmParamsText[selectedLlm.name] ?? "{}"}
                        onChange={(event) =>
                          setCurrentLlmParamsText(event.target.value)
                        }
                      />
                    </Field>
                    <Field
                      orientation="horizontal"
                      data-disabled={
                        configDraft.llms.length <= 1 ? true : undefined
                      }
                    >
                      <Checkbox
                        id={defaultSessionsCheckboxId}
                        checked={Boolean(
                          configDraft.llms.find(
                            (entry) => entry.name === selectedLlmName,
                          )?.default,
                        )}
                        disabled={configDraft.llms.length <= 1}
                        onCheckedChange={(checked) => {
                          const row = configDraft.llms.find(
                            (entry) => entry.name === selectedLlmName,
                          );
                          if (!row) return;
                          if (checked === true) {
                            if (!row.default) {
                              setDefaultLlm(row.name);
                            }
                            return;
                          }
                          if (
                            checked === false &&
                            row.default &&
                            configDraft.llms.length > 1
                          ) {
                            const other = configDraft.llms.find(
                              (entry) => entry.name !== row.name,
                            );
                            if (other) {
                              setDefaultLlm(other.name);
                            }
                          }
                        }}
                      />
                      <FieldContent>
                        <FieldLabel
                          htmlFor={defaultSessionsCheckboxId}
                          className="font-normal"
                        >
                          Default for new sessions
                        </FieldLabel>
                      </FieldContent>
                    </Field>
                  </>
                ) : null}
              </TabsContent>

              <TabsContent value="search" className="mt-0 flex flex-col gap-4">
                <ToggleRow
                  label="Web search"
                  checked={configDraft.search.enabled}
                  onCheckedChange={(enabled) =>
                    updateDraft((draft) => ({
                      ...draft,
                      search: { ...draft.search, enabled },
                    }))
                  }
                />
                {configDraft.search.enabled ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field>
                      <FieldLabel>Provider</FieldLabel>
                      <Select
                        value={configDraft.search.provider}
                        onValueChange={(value) =>
                          updateDraft((draft) => ({
                            ...draft,
                            search: {
                              ...draft.search,
                              provider: value as never,
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {(["brave", "serper", "tavily"] as const).map(
                              (item) => (
                                <SelectItem key={item} value={item}>
                                  {SEARCH_PROVIDER_LABELS[item]}
                                </SelectItem>
                              ),
                            )}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>
                        {SEARCH_PROVIDER_LABELS[configDraft.search.provider]}{" "}
                        API key
                      </FieldLabel>
                      <Input
                        type="password"
                        value={
                          configDraft.search[configDraft.search.provider]
                            .apiKey ?? ""
                        }
                        onChange={(event) => {
                          const providerName = configDraft.search.provider;
                          updateDraft((draft) => ({
                            ...draft,
                            search: {
                              ...draft.search,
                              [providerName]: {
                                apiKey: event.target.value || undefined,
                              },
                            },
                          }));
                        }}
                      />
                    </Field>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="prompts" className="mt-0 grid gap-3">
                {(
                  [
                    "behaviour",
                    "communication",
                    "execution",
                    "engineering",
                    "guardrails",
                  ] as const
                ).map((prompt) => (
                  <ToggleRow
                    key={prompt}
                    label={PROMPT_LABELS[prompt]}
                    checked={configDraft.prompts[prompt]}
                    onCheckedChange={(enabled) =>
                      updateDraft((draft) => ({
                        ...draft,
                        prompts: { ...draft.prompts, [prompt]: enabled },
                      }))
                    }
                  />
                ))}
              </TabsContent>

              <TabsContent value="tools" className="mt-0 grid gap-3">
                {(
                  ["todo", "fetch", "filesystem", "shell", "sleep"] as const
                ).map((tool) => (
                  <ToggleRow
                    key={tool}
                    label={TOOL_LABELS[tool]}
                    checked={configDraft.tools[tool].enabled}
                    onCheckedChange={(enabled) =>
                      updateToolToggle(tool, enabled)
                    }
                  />
                ))}
              </TabsContent>

              <TabsContent value="memory" className="mt-0 flex flex-col gap-4">
                <ToggleRow
                  label="Long-term memory"
                  checked={configDraft.tools.ltm.enabled}
                  onCheckedChange={(enabled) =>
                    updateDraft((draft) => ({
                      ...draft,
                      tools: {
                        ...draft.tools,
                        ltm: { ...draft.tools.ltm, enabled },
                      },
                    }))
                  }
                />
                {configDraft.tools.ltm.enabled ? (
                  <FieldGroup className="grid gap-3 md:grid-cols-2">
                    <Field>
                      <FieldLabel>Memory URL</FieldLabel>
                      <Input
                        value={configDraft.tools.ltm.chroma.url}
                        onChange={(event) =>
                          updateDraft((draft) => ({
                            ...draft,
                            tools: {
                              ...draft.tools,
                              ltm: {
                                ...draft.tools.ltm,
                                chroma: {
                                  ...draft.tools.ltm.chroma,
                                  url: event.target.value,
                                },
                              },
                            },
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Memory collection</FieldLabel>
                      <Input
                        value={configDraft.tools.ltm.chroma.collection.memory}
                        onChange={(event) =>
                          updateDraft((draft) => ({
                            ...draft,
                            tools: {
                              ...draft.tools,
                              ltm: {
                                ...draft.tools.ltm,
                                chroma: {
                                  ...draft.tools.ltm.chroma,
                                  collection: { memory: event.target.value },
                                },
                              },
                            },
                          }))
                        }
                      />
                    </Field>
                  </FieldGroup>
                ) : null}
                <ToggleRow
                  label="Wiki"
                  checked={configDraft.tools.wiki.enabled}
                  onCheckedChange={(enabled) =>
                    updateDraft((draft) => ({
                      ...draft,
                      tools: {
                        ...draft.tools,
                        wiki: { ...draft.tools.wiki, enabled },
                      },
                    }))
                  }
                />
                {configDraft.tools.wiki.enabled ? (
                  <FieldGroup className="grid gap-3 md:grid-cols-2">
                    <Field>
                      <FieldLabel>Wiki URL</FieldLabel>
                      <Input
                        value={configDraft.tools.wiki.chroma.url}
                        onChange={(event) =>
                          updateDraft((draft) => ({
                            ...draft,
                            tools: {
                              ...draft.tools,
                              wiki: {
                                ...draft.tools.wiki,
                                chroma: {
                                  ...draft.tools.wiki.chroma,
                                  url: event.target.value,
                                },
                              },
                            },
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Wiki collection</FieldLabel>
                      <Input
                        value={configDraft.tools.wiki.chroma.collection.wiki}
                        onChange={(event) =>
                          updateDraft((draft) => ({
                            ...draft,
                            tools: {
                              ...draft.tools,
                              wiki: {
                                ...draft.tools.wiki,
                                chroma: {
                                  ...draft.tools.wiki.chroma,
                                  collection: { wiki: event.target.value },
                                },
                              },
                            },
                          }))
                        }
                      />
                    </Field>
                  </FieldGroup>
                ) : null}
              </TabsContent>

              <TabsContent value="agents" className="mt-0 flex flex-col gap-4">
                <ToggleRow
                  label="Subagents"
                  checked={configDraft.tools.agents.enabled}
                  onCheckedChange={(enabled) =>
                    updateDraft((draft) => ({
                      ...draft,
                      tools: {
                        ...draft.tools,
                        agents: { ...draft.tools.agents, enabled },
                      },
                    }))
                  }
                />
                <Field>
                  <FieldLabel>Concurrency</FieldLabel>
                  <Input
                    min={1}
                    type="number"
                    value={configDraft.tools.agents.concurrency}
                    onChange={(event) =>
                      updateDraft((draft) => ({
                        ...draft,
                        tools: {
                          ...draft.tools,
                          agents: {
                            ...draft.tools.agents,
                            concurrency: Number(event.target.value || 1),
                          },
                        },
                      }))
                    }
                  />
                </Field>
              </TabsContent>

              <TabsContent
                value="compaction"
                className="mt-0 grid gap-3 md:grid-cols-2"
              >
                <Field>
                  <FieldLabel>Ratio</FieldLabel>
                  <Input
                    max={1}
                    min={0}
                    step={0.05}
                    type="number"
                    value={configDraft.compaction.ratio}
                    onChange={(event) =>
                      updateDraft((draft) => ({
                        ...draft,
                        compaction: {
                          ...draft.compaction,
                          ratio: Number(event.target.value || 0),
                        },
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Keep recent turns</FieldLabel>
                  <Input
                    min={0}
                    type="number"
                    value={configDraft.compaction.keep}
                    onChange={(event) =>
                      updateDraft((draft) => ({
                        ...draft,
                        compaction: {
                          ...draft.compaction,
                          keep: Number(event.target.value || 0),
                        },
                      }))
                    }
                  />
                </Field>
              </TabsContent>
            </Tabs>
          ) : null}
          {configErrors.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>Fix configuration</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  {configErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={props.busy || !props.config || !configDraft}
              onClick={() =>
                void (async () => {
                  props.setBusy(true);
                  setConfigErrors([]);
                  try {
                    if (!configDraft) return;
                    const updated = await saveConfig({
                      ...configDraft,
                      llms: parseAllLlmParams(),
                      instructions,
                    });
                    props.setConfig(updated);
                    toast.success("Configuration saved.");
                  } catch (error) {
                    setConfigErrors(configErrorMessages(error));
                  } finally {
                    props.setBusy(false);
                  }
                })()
              }
            >
              <CheckIcon />
              Save
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <RotateCcwIcon />
                  Restart
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Restart agent?</DialogTitle>
                  <DialogDescription>
                    This will restart the agent. Active chat turns may be
                    interrupted.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      variant="destructive"
                      onClick={() => void restartServices()}
                    >
                      <RotateCcwIcon />
                      Restart
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>MCP servers</CardTitle>
              <CardDescription>
                Add servers that give the agent more tools.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={startAddMcpServer}>
                <PlusIcon />
                Add server
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {props.mcp.length > 0 ? (
              props.mcp.map((server) => (
                <div
                  key={server.name}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{server.name}</p>
                      <Badge variant="secondary">
                        {MCP_CONNECTION_LABELS[server.transport.type]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {server.summary}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => editMcpServer(server)}
                    >
                      Edit
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="ghost">
                          Remove
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Remove MCP server?</DialogTitle>
                          <DialogDescription>
                            Remove {server.name} from the agent.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                          </DialogClose>
                          <DialogClose asChild>
                            <Button
                              variant="destructive"
                              onClick={() =>
                                void runTask(async () => {
                                  const data = await removeMcp(server.name);
                                  props.setMcp(data.servers);
                                  if (mcpEditingName === server.name) {
                                    setMcpDialogOpen(false);
                                    resetMcpForm();
                                  }
                                }, "MCP server removed.")
                              }
                            >
                              Remove
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No MCP servers configured.
              </div>
            )}
          </div>
          <Dialog
            open={mcpDialogOpen}
            onOpenChange={(open) => {
              setMcpDialogOpen(open);
              if (!open) resetMcpForm();
            }}
          >
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {mcpEditingName ? "Edit MCP server" : "Add MCP server"}
                </DialogTitle>
                <DialogDescription>
                  Choose how the agent connects to this server.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <Field>
                    <FieldLabel>Server name</FieldLabel>
                    <Input
                      disabled={Boolean(mcpEditingName)}
                      placeholder="filesystem"
                      value={mcpName}
                      onChange={(event) => setMcpName(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Connection type</FieldLabel>
                    <Select
                      value={mcpType}
                      onValueChange={(value) =>
                        setMcpType(value as McpTransportType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Connection type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="stdio">Local command</SelectItem>
                          <SelectItem value="streamable-http">
                            Remote server
                          </SelectItem>
                          <SelectItem value="sse">Event stream</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {mcpType === "stdio" ? (
                  <div className="grid gap-4">
                    <Field>
                      <FieldLabel>Command line</FieldLabel>
                      <Input
                        placeholder="npx -y @modelcontextprotocol/server-filesystem /path with spaces"
                        value={mcpCommand}
                        onChange={(event) => setMcpCommand(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Working directory</FieldLabel>
                      <Input
                        placeholder="Optional"
                        value={mcpCwd}
                        onChange={(event) => setMcpCwd(event.target.value)}
                      />
                    </Field>
                    <KeyValueEditor
                      addLabel="Add variable"
                      entries={mcpEnvEntries}
                      keyPlaceholder="Variable"
                      label="Environment"
                      valuePlaceholder="Value"
                      onChange={setMcpEnvEntries}
                    />
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <Field>
                      <FieldLabel>URL</FieldLabel>
                      <Input
                        placeholder="https://example.com/mcp"
                        value={mcpUrl}
                        onChange={(event) => setMcpUrl(event.target.value)}
                      />
                    </Field>
                    <KeyValueEditor
                      addLabel="Add header"
                      entries={mcpHeaderEntries}
                      keyPlaceholder="Header"
                      label="Headers"
                      valuePlaceholder="Value"
                      onChange={setMcpHeaderEntries}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  disabled={props.busy}
                  onClick={() =>
                    void runTask(
                      async () => {
                        const transport = buildMcpTransport();
                        const data = mcpEditingName
                          ? await updateMcp(mcpEditingName, { transport })
                          : await addMcp({ name: mcpName, transport });
                        props.setMcp(data.servers);
                        setMcpDialogOpen(false);
                        resetMcpForm();
                      },
                      mcpEditingName
                        ? "MCP server updated."
                        : "MCP server added.",
                    )
                  }
                >
                  {mcpEditingName ? "Save server" : "Add server"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog
            open={Boolean(skillInstallCandidate)}
            onOpenChange={(open) => {
              if (!open) setSkillInstallCandidate(null);
            }}
          >
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Install skill?</DialogTitle>
                <DialogDescription>
                  Add {skillInstallCandidate?.name ?? "this skill"} to the
                  agent.
                </DialogDescription>
              </DialogHeader>
              {skillInstallCandidate ? (
                <div className="rounded-md border bg-muted/20 p-3 text-sm">
                  <p className="font-medium">{skillInstallCandidate.name}</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {skillInstallCandidate.details ??
                      skillInstallCandidate.source}
                  </p>
                </div>
              ) : null}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  disabled={props.busy || !skillInstallCandidate}
                  onClick={() =>
                    void runTask(async () => {
                      if (!skillInstallCandidate) return;
                      const data = await installSkill(
                        skillInstallCandidate.source,
                      );
                      props.setSkills(data.skills);
                      clearSkillInstallState();
                    }, "Skill installed.")
                  }
                >
                  Install
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Skills</CardTitle>
              <CardDescription>
                Add reusable skills for the agent.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={() => {
                setSkillDialogOpen(true);
              }}
            >
              <PlusIcon />
              Add skill
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {props.skills.length > 0 ? (
              props.skills.map((skill) => (
                <div
                  key={skill.path}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{skill.name}</p>
                    {skill.description ? (
                      <p className="text-xs text-muted-foreground">
                        {skill.description}
                      </p>
                    ) : null}
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="ghost">
                        Remove
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Remove skill?</DialogTitle>
                        <DialogDescription>
                          Remove {skill.name} from the local skills folder.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button
                            variant="destructive"
                            onClick={() =>
                              void runTask(async () => {
                                const data = await removeSkill(
                                  skillFolder(skill.path),
                                );
                                props.setSkills(data.skills);
                              }, "Skill removed.")
                            }
                          >
                            Remove
                          </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No skills installed.
              </div>
            )}
          </div>
          <Dialog
            open={skillDialogOpen}
            onOpenChange={(open) => {
              setSkillDialogOpen(open);
              if (!open) {
                setSkillQuery("");
                setSkillSource("");
                props.setSkillResults([]);
              }
            }}
          >
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add skill</DialogTitle>
                <DialogDescription>
                  Search for a skill or install one from a link or local folder.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-5">
                <div className="grid gap-3">
                  <form
                    className="grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitSkillSearch();
                    }}
                  >
                    <FieldLabel>Search catalog</FieldLabel>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search catalog"
                        value={skillQuery}
                        onChange={(event) => setSkillQuery(event.target.value)}
                      />
                      <Button type="submit" variant="outline">
                        Search
                      </Button>
                    </div>
                  </form>
                  {props.skillResults.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {props.skillResults.map((result) => (
                        <div
                          key={result.slug || result.source}
                          className="flex items-center justify-between gap-3 rounded-md border p-3"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium">
                                {result.name}
                              </p>
                              <Badge variant="secondary">
                                {result.installs.toLocaleString()} installs
                              </Badge>
                            </div>
                            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                              {result.source}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              requestSkillInstall({
                                name: result.name,
                                source: result.slug || result.source,
                                details: result.source,
                              })
                            }
                          >
                            Install
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <FieldSeparator>OR</FieldSeparator>
                <form
                  className="grid gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitSkillSourceInstall();
                  }}
                >
                  <FieldLabel>Install from link or folder</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="owner/repo, GitHub URL, or local folder"
                      value={skillSource}
                      onChange={(event) => setSkillSource(event.target.value)}
                    />
                    <Button type="submit">Install</Button>
                  </div>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
