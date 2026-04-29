import fastq from "fastq";
import { BeforeToolCallEvent } from "@strands-agents/sdk";
import {
  TOOL_APPROVAL_INTERNAL_ALWAYS_ALLOWED,
  allowToolForSession,
  bootstrap,
  consumeExitRequest,
  isToolSessionAllowed,
  type McpManager,
} from "hoomanjs";
import type { ApprovalDecision } from "../client/types.js";
import type { ApprovalController, ApprovalToolCallEvent } from "./approval.js";

export type WorkerAgent = Awaited<ReturnType<typeof bootstrap>>["agent"];
export type AgentWorkerInput = Parameters<WorkerAgent["stream"]>[0];

export type AgentWorkerStatus = {
  running: boolean;
  queued: number;
};

export type AgentWorkerJob = {
  id: string;
  source: "chat" | "channel";
  sessionId?: string;
  userId?: string;
  origin?: Record<string, unknown>;
  input: AgentWorkerInput;
  yolo?: boolean;
  approval?: ApprovalController;
  onStart?: (agent: WorkerAgent) => void;
  onStreamEvent?: (event: unknown, agent: WorkerAgent) => void;
  onSuccess?: (agent: WorkerAgent) => void;
  onError?: (error: unknown) => void;
  onComplete?: (agent: WorkerAgent) => void;
  onExit?: () => void | Promise<void>;
};

export class AgentWorker {
  private agent: WorkerAgent | null = null;
  private manager: McpManager | null = null;
  private activeJob: AgentWorkerJob | null = null;
  private readonly resetListeners = new Set<() => void | Promise<void>>();
  private readonly queue: fastq.queueAsPromised<AgentWorkerJob, void>;

  public constructor() {
    this.queue = fastq.promise((job) => this.run(job), 1);
  }

  public status(): AgentWorkerStatus {
    return {
      running: Boolean(this.activeJob),
      queued: this.queue.length(),
    };
  }

  public async enqueue(job: AgentWorkerJob): Promise<void> {
    await this.queue.push(job);
  }

  public cancel(jobId: string): void {
    if (this.activeJob?.id === jobId) {
      this.agent?.cancel();
    }
  }

  public onReset(listener: () => void | Promise<void>): () => void {
    this.resetListeners.add(listener);
    return () => this.resetListeners.delete(listener);
  }

  public async getMcpManager(): Promise<McpManager> {
    await this.ensureAgent();
    return this.manager!;
  }

  public async close(): Promise<void> {
    this.queue.kill();
    await this.resetAgent();
    this.activeJob = null;
  }

  private async resetAgent(): Promise<void> {
    await this.manager?.disconnect().catch(() => undefined);
    this.manager = null;
    this.agent = null;
  }

  private async notifyReset(): Promise<void> {
    await Promise.all([...this.resetListeners].map((listener) => listener()));
  }

  private async ensureAgent(): Promise<WorkerAgent> {
    if (this.agent) {
      return this.agent;
    }
    const {
      agent,
      mcp: { manager },
    } = await bootstrap("daemon", {}, false);
    agent.addHook(
      BeforeToolCallEvent as never,
      ((event: unknown) =>
        this.handleApproval(event as ApprovalToolCallEvent)) as never,
    );
    this.agent = agent;
    this.manager = manager;
    return agent;
  }

  private async handleApproval(event: ApprovalToolCallEvent): Promise<void> {
    const job = this.activeJob;
    const toolName = event.toolUse.name;
    if (
      !job?.approval ||
      job.yolo ||
      TOOL_APPROVAL_INTERNAL_ALWAYS_ALLOWED.has(toolName) ||
      isToolSessionAllowed(event.agent, toolName)
    ) {
      return;
    }

    const decision: ApprovalDecision = await job.approval.request(event);
    if (decision === "allow") {
      return;
    }
    if (decision === "always") {
      allowToolForSession(event.agent, toolName);
      return;
    }
    event.cancel = `Tool "${toolName}" was rejected by the user.`;
  }

  private applyJobState(agent: WorkerAgent, job: AgentWorkerJob): void {
    if (job.userId) {
      agent.appState.set("userId", job.userId);
    }
    if (job.sessionId) {
      agent.appState.set("sessionId", job.sessionId);
    }
    if (job.origin) {
      agent.appState.set("origin", job.origin);
    }
  }

  private async run(job: AgentWorkerJob): Promise<void> {
    this.activeJob = job;
    let agent: WorkerAgent | null = null;
    try {
      agent = await this.ensureAgent();
      this.applyJobState(agent, job);
      job.onStart?.(agent);
      for await (const event of agent.stream(job.input)) {
        job.onStreamEvent?.(event, agent);
      }
      job.onSuccess?.(agent);
    } catch (error) {
      job.onError?.(error);
    } finally {
      if (agent) {
        job.onComplete?.(agent);
        if (consumeExitRequest(agent)) {
          await this.resetAgent();
          await this.notifyReset();
          await job.onExit?.();
        }
      }
      if (this.activeJob?.id === job.id) {
        this.activeJob = null;
      }
    }
  }
}
