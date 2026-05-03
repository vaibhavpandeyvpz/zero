import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { Message, TextBlock, type MessageData } from "@strands-agents/sdk";
import {
  applySessionMode,
  attachmentPathsToPromptBlocks,
  bootstrap,
  getModeState,
  getTodoViewState,
  setSessionMode as applyAgentSessionMode,
  setYoloEnabled,
  takeFileToolDisplay,
  type McpManager,
  type SessionMode,
  type TodoViewState,
} from "hoomanjs";
import type {
  ApprovalDecision,
  ChatLine,
  ChatSendRequest,
  ChatSessionMode,
  ChatSessionSnapshot,
  ChatStreamEvent,
} from "../client/types.js";
import { attachmentsPath } from "../lib/paths.js";
import {
  AgentWorker,
  type AgentWorkerInput,
  type WorkerAgent,
} from "./agent-worker.js";
import { ApprovalController } from "./approval.js";
import {
  getToolUseId,
  stringifyUnknown,
  toToolResultText,
  type StreamEvent,
} from "./agents/chat-stream-events.js";
import { createSessionConfig, type SessionConfig } from "./session-config.js";

type QueuedPrompt = {
  id: string;
  text: string;
  attachments: string[];
  assistantLineId: string;
};

type StreamJob = QueuedPrompt & {
  emit: (event: ChatStreamEvent) => void;
};

function nowId(): string {
  return `${Date.now().toString(36)}-${crypto.randomUUID()}`;
}

function normalizePrompt(
  input: ChatSendRequest,
  assistantLineId: string,
): QueuedPrompt {
  return {
    id: nowId(),
    text: input.text.trim(),
    attachments: resolveUploadedAttachments(input.attachments ?? []),
    assistantLineId,
  };
}

function resolveUploadedAttachments(attachments: string[]): string[] {
  return [...new Set(attachments)]
    .map((name) => basename(name.trim()))
    .filter(Boolean)
    .map((name) => join(attachmentsPath(), name))
    .filter((path) => existsSync(path));
}

export class ChatSession {
  private readonly lines: ChatLine[] = [];
  private readonly queued: QueuedPrompt[] = [];
  private readonly toolLineIds = new Map<string, string>();
  private readonly pendingToolLineIds: string[] = [];
  private readonly approval = new ApprovalController(() =>
    this.emitApprovalChange(),
  );
  private running = false;
  private status = "ready";
  private yolo = false;
  /** UI preference before an agent exists; once live, snapshot prefers {@link getModeState}. */
  private preferredSessionMode: ChatSessionMode = "default";
  private readonly config: SessionConfig;
  private agent: WorkerAgent | null = null;
  private manager: McpManager | null = null;
  private assistantLineId: string | null = null;
  private activeJobId: string | null = null;
  private todos: TodoViewState | undefined;
  private todosJson = "";
  private usage: ChatSessionSnapshot["usage"];

  private activeEmit: ((event: ChatStreamEvent) => void) | null = null;

  public constructor(
    public readonly sessionId: string,
    private readonly worker: AgentWorker,
  ) {
    this.config = createSessionConfig();
  }

  public async stream(
    input: ChatSendRequest,
    emit: (event: ChatStreamEvent) => void,
  ): Promise<void> {
    const text = input.text.trim();
    const attachments = [...new Set(input.attachments ?? [])].filter(Boolean);
    if (!text && resolveUploadedAttachments(attachments).length === 0) {
      return;
    }
    const userLine = this.appendLine({
      role: "user",
      content:
        attachments.length > 0
          ? `${text || "[attachments]"}\n\n${attachments
              .map((path) => `[attachment] ${path}`)
              .join("\n")}`
          : text,
      done: true,
    });
    emit({ type: "user.message", line: userLine });
    const assistantLine = this.appendLine({
      role: "assistant",
      content: "",
      done: false,
    });
    emit({ type: "assistant.created", line: assistantLine });
    const prompt = normalizePrompt(
      { ...input, text, attachments },
      assistantLine.id,
    );
    if (!prompt.text && prompt.attachments.length === 0) {
      return;
    }
    if (input.yolo !== undefined) {
      this.yolo = Boolean(input.yolo);
      this.worker.setDefaultYolo(this.yolo);
    }
    this.queued.push(prompt);
    emit({ type: "turn.queued", queued: [...this.queued] });
    await this.runTurn({ ...prompt, emit }).catch((error) => {
      this.removeQueued(prompt.id);
      const line = this.appendLine({
        role: "system",
        title: "error",
        content: error instanceof Error ? error.message : String(error),
        done: true,
      });
      emit({
        type: "turn.error",
        message: error instanceof Error ? error.message : String(error),
        line,
      });
    });
  }

  public approve(decision: ApprovalDecision): boolean {
    return this.approval.decide(decision);
  }

  public cancel(): void {
    if (this.activeJobId) {
      this.worker.cancel(this.activeJobId);
    }
    this.status = "cancel requested";
  }

  public snapshot(): ChatSessionSnapshot {
    const sessionMode: ChatSessionMode =
      this.agent != null
        ? (getModeState(this.agent).mode as ChatSessionMode)
        : this.preferredSessionMode;
    return {
      sessionId: this.sessionId,
      running: this.running,
      yolo: this.yolo,
      sessionMode,
      queued: [...this.queued],
      lines: [...this.lines],
      approvals: this.approval.pending,
      status: this.status,
      todos: this.todos,
      usage: this.usage,
      model: this.currentModel(),
      models: this.config.llms.map((entry) => ({
        name: entry.name,
        provider: entry.options.provider,
        model: entry.options.model,
        default: entry.default,
      })),
    };
  }

  public setYolo(enabled: boolean): void {
    this.yolo = enabled;
    this.worker.setDefaultYolo(enabled);
    if (this.agent) {
      setYoloEnabled(this.agent, enabled);
    }
  }

  public setSessionMode(mode: ChatSessionMode): void {
    this.preferredSessionMode = mode;
    if (this.agent) {
      applyAgentSessionMode(this.agent, mode as SessionMode);
      applySessionMode(this.agent);
    }
  }

  private syncAgentPreferences(agent: WorkerAgent): void {
    setYoloEnabled(agent, this.yolo);
    applyAgentSessionMode(agent, this.preferredSessionMode as SessionMode);
    applySessionMode(agent);
  }

  public async setModel(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Model name is required.");
    }
    const current = this.currentModel();
    if (trimmed === current) {
      return;
    }
    if (!this.config.llms.some((entry) => entry.name === trimmed)) {
      throw new Error(`Unknown model "${trimmed}".`);
    }
    this.config.update({
      llms: this.config.llms.map((entry) => ({
        ...entry,
        default: entry.name === trimmed,
      })),
    });
    if (this.agent) {
      await this.rebuildAgent();
    }
  }

  public async close(): Promise<void> {
    this.queued.length = 0;
    try {
      this.agent?.cancel?.();
    } catch {
      /* ignore */
    }
    await this.manager?.disconnect().catch(() => undefined);
    this.manager = null;
    this.agent = null;
  }

  private async runTurn(prompt: StreamJob): Promise<void> {
    this.running = true;
    this.status = "thinking";
    const assistantId = prompt.assistantLineId;
    this.assistantLineId = assistantId;
    this.activeJobId = prompt.id;
    this.activeEmit = prompt.emit;
    const agent = await this.ensureAgent();
    this.syncAgentPreferences(agent);
    await this.worker.enqueue({
      id: prompt.id,
      agent,
      source: "chat",
      sessionId: this.sessionId,
      userId: this.sessionId,
      input: await this.toStreamInput(prompt),
      yolo: this.yolo,
      approval: this.approval,
      onStart: () => {
        const index = this.queued.findIndex((item) => item.id === prompt.id);
        if (index >= 0) {
          this.queued.splice(index, 1);
        }
        prompt.emit({ type: "turn.started", queued: [...this.queued] });
      },
      onStreamEvent: (event, agent) => {
        this.handleStreamEvent(event as StreamEvent, agent, prompt.emit);
        this.refreshTodos(agent, prompt.emit);
      },
      onError: (error) => {
        const line = this.appendLine({
          role: "system",
          title: "error",
          content: error instanceof Error ? error.message : String(error),
          done: true,
        });
        this.finishPendingTools();
        this.running = false;
        this.status = "error";
        this.activeJobId = null;
        this.activeEmit = null;
        prompt.emit({
          type: "turn.error",
          message: error instanceof Error ? error.message : String(error),
          line,
        });
      },
      onComplete: (agent) => {
        this.updateLine(assistantId, { done: true });
        this.assistantLineId = null;
        this.refreshTodos(agent, prompt.emit);
        this.finishPendingTools();
        this.running = false;
        this.status = "ready";
        prompt.emit({
          type: "turn.completed",
          assistantLineId: assistantId,
          usage: this.usage,
          todos: this.todos,
        });
        this.activeJobId = null;
        this.activeEmit = null;
      },
    });
  }

  private async ensureAgent(): Promise<WorkerAgent> {
    if (this.agent) {
      return this.agent;
    }
    const {
      agent,
      mcp: { manager },
    } = await bootstrap(
      "default",
      {
        sessionId: this.sessionId,
        userId: this.sessionId,
        yolo: this.yolo,
        sessionMode: this.preferredSessionMode as SessionMode,
      },
      false,
      this.config,
    );
    this.agent = agent;
    this.manager = manager;
    return agent;
  }

  private async rebuildAgent(): Promise<void> {
    if (!this.agent) {
      return;
    }
    const snapshot: MessageData[] = this.agent.messages.map((message) =>
      message.toJSON(),
    );
    const oldManager = this.manager;
    const {
      agent,
      mcp: { manager },
    } = await bootstrap(
      "default",
      {
        sessionId: this.sessionId,
        userId: this.sessionId,
        yolo: this.yolo,
        sessionMode: this.preferredSessionMode as SessionMode,
      },
      false,
      this.config,
    );
    agent.messages.length = 0;
    for (const message of snapshot) {
      // Strands `Message` types differ when Zero and hoomanjs resolve duplicate `@strands-agents/sdk` installs.
      agent.messages.push(Message.fromJSON(message) as never);
    }
    this.agent = agent;
    this.manager = manager;
    await oldManager?.disconnect().catch(() => undefined);
  }

  private currentModel(): string {
    return (
      this.config.llms.find((entry) => entry.default)?.name ??
      this.config.llms[0]?.name ??
      "unknown"
    );
  }

  private async toStreamInput(prompt: QueuedPrompt): Promise<AgentWorkerInput> {
    const attachmentBlocks = await attachmentPathsToPromptBlocks(
      prompt.attachments,
    );
    if (attachmentBlocks.length === 0) {
      return prompt.text;
    }
    const content = [
      ...(prompt.text ? [new TextBlock(prompt.text)] : []),
      ...attachmentBlocks,
    ];
    return content as AgentWorkerInput;
  }

  private handleStreamEvent(
    event: StreamEvent,
    agent: WorkerAgent,
    emit: (event: ChatStreamEvent) => void,
  ): void {
    switch (event.type) {
      case "contentBlockEvent": {
        const block = event.contentBlock as {
          type?: string;
          text?: string;
          name?: string;
          input?: unknown;
        };
        if (block.type === "textBlock") {
          this.appendAssistantText(block.text ?? "", emit);
        }
        if (block.type === "toolUseBlock") {
          const toolLine = this.appendLine({
            role: "tool",
            title: "tool",
            toolName: block.name ?? "unknown",
            content: stringifyUnknown(block.input ?? {}),
            phase: "running",
            done: false,
          });
          const toolUseId = getToolUseId(block);
          if (toolUseId) {
            this.toolLineIds.set(toolUseId, toolLine.id);
          } else {
            this.pendingToolLineIds.push(toolLine.id);
          }
          this.moveLineToEnd(this.assistantLineId);
          emit({
            type: "tool.started",
            line: toolLine,
            assistantLineId: this.assistantLineId ?? undefined,
          });
        }
        break;
      }
      case "toolResultEvent": {
        const toolUseId = getToolUseId(event.result);
        let toolLineId = toolUseId
          ? this.toolLineIds.get(toolUseId)
          : undefined;
        if (toolUseId) {
          this.toolLineIds.delete(toolUseId);
        }
        toolLineId ??= this.pendingToolLineIds.shift();
        if (toolLineId) {
          const fileToolDisplay = toolUseId
            ? takeFileToolDisplay(agent.appState, toolUseId)
            : undefined;
          this.updateLine(toolLineId, {
            phase: "done",
            done: true,
            resultContent: toToolResultText(event.result),
            fileToolDisplay,
          });
          emit({
            type: "tool.result",
            lineId: toolLineId,
            resultContent: toToolResultText(event.result),
            fileToolDisplay,
          });
        }
        break;
      }
      case "toolStreamUpdateEvent":
        this.status = "running tool";
        break;
      case "modelStreamUpdateEvent":
        this.handleModelEvent(event.event, emit);
        break;
      default:
        break;
    }
  }

  private handleModelEvent(
    event: StreamEvent["event"],
    emit: (event: ChatStreamEvent) => void,
  ): void {
    if (event?.type === "modelContentBlockDeltaEvent") {
      const delta = event.delta;
      if (delta?.type === "reasoningContentDelta" && delta.text) {
        this.status = "thinking";
        this.appendAssistantReasoning(delta.text, emit);
      } else {
        this.status = "streaming";
      }
    }
    if (event?.type === "modelMetadataEvent") {
      const usage = (event.usage ?? {}) as {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
      };
      const metrics = (event.metrics ?? {}) as { latencyMs?: number };
      this.usage = {
        input: usage.inputTokens ?? 0,
        output: usage.outputTokens ?? 0,
        total: usage.totalTokens ?? 0,
        latency: metrics.latencyMs ?? 0,
      };
      emit({ type: "usage.updated", usage: this.usage });
    }
  }

  private appendAssistantText(
    text: string,
    emit: (event: ChatStreamEvent) => void,
  ): void {
    const assistant = this.currentAssistantLine();
    if (assistant) {
      assistant.content += text;
      this.moveLineToEnd(assistant.id);
      emit({ type: "assistant.delta", lineId: assistant.id, text });
    }
  }

  private appendAssistantReasoning(
    text: string,
    emit: (event: ChatStreamEvent) => void,
  ): void {
    const assistant = this.currentAssistantLine();
    if (assistant) {
      assistant.reasoningContent = `${assistant.reasoningContent ?? ""}${text}`;
      emit({ type: "reasoning.delta", lineId: assistant.id, text });
    }
  }

  private appendLine(line: Omit<ChatLine, "id">): ChatLine {
    const id = nowId();
    const nextLine = { id, ...line };
    this.lines.push(nextLine);
    return nextLine;
  }

  private updateLine(id: string, patch: Partial<ChatLine>): void {
    const line = this.lines.find((item) => item.id === id);
    if (line) {
      Object.assign(line, patch);
    }
  }

  private currentAssistantLine(): ChatLine | undefined {
    if (this.assistantLineId) {
      return this.lines.find((line) => line.id === this.assistantLineId);
    }
    return [...this.lines]
      .reverse()
      .find((line) => line.role === "assistant" && !line.done);
  }

  private moveLineToEnd(id: string | null): void {
    if (!id) {
      return;
    }
    const index = this.lines.findIndex((line) => line.id === id);
    if (index < 0 || index === this.lines.length - 1) {
      return;
    }
    const [line] = this.lines.splice(index, 1);
    if (line) {
      this.lines.push(line);
    }
  }

  private refreshTodos(
    agent: WorkerAgent,
    emit?: (event: ChatStreamEvent) => void,
  ): void {
    const todos = getTodoViewState(agent);
    const todosJson = JSON.stringify(todos);
    this.todos = todos;
    if (this.todos && todosJson !== this.todosJson) {
      this.todosJson = todosJson;
      emit?.({ type: "todos.updated", todos: this.todos });
    }
  }

  private finishPendingTools(): void {
    for (const toolLineId of this.toolLineIds.values()) {
      this.updateLine(toolLineId, { phase: "done", done: true });
    }
    for (const toolLineId of this.pendingToolLineIds) {
      this.updateLine(toolLineId, { phase: "done", done: true });
    }
    this.toolLineIds.clear();
    this.pendingToolLineIds.length = 0;
  }

  private removeQueued(id: string): void {
    const index = this.queued.findIndex((item) => item.id === id);
    if (index >= 0) {
      this.queued.splice(index, 1);
    }
  }

  private emitApprovalChange(): void {
    if (this.approval.pending) {
      this.activeEmit?.({
        type: "approval.request",
        request: this.approval.pending,
      });
    } else {
      this.activeEmit?.({ type: "approval.cleared" });
    }
  }
}

export class ChatSessions {
  private readonly sessions = new Map<string, ChatSession>();

  public constructor(private readonly worker: AgentWorker) {}

  public get(id?: string): ChatSession {
    const sessionId = id ?? crypto.randomUUID();
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new ChatSession(sessionId, this.worker);
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  public async closeAll(): Promise<void> {
    await Promise.all(
      [...this.sessions.values()].map((session) => session.close()),
    );
    this.sessions.clear();
  }
}
