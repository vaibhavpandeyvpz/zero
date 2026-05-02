import fastq from "fastq";
import { BeforeToolCallEvent } from "@strands-agents/sdk";
import { bootstrap, consumeExitRequest, type McpManager } from "hoomanjs";
import { createApprovalHandler } from "./approval.js";
import type { ApprovalController } from "./approval.js";

export type WorkerAgent = Awaited<ReturnType<typeof bootstrap>>["agent"];
export type AgentWorkerInput = Parameters<WorkerAgent["stream"]>[0];

export type AgentWorkerStatus = {
  running: boolean;
  queued: number;
};

export type AgentWorkerJob = {
  id: string;
  source: "chat" | "channel";
  agent?: WorkerAgent;
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
  private defaultAgent: WorkerAgent | null = null;
  private defaultManager: McpManager | null = null;
  private activeJob: AgentWorkerJob | null = null;
  private activeAgent: WorkerAgent | null = null;
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
      this.activeAgent?.cancel();
    }
  }

  public onReset(listener: () => void | Promise<void>): () => void {
    this.resetListeners.add(listener);
    return () => this.resetListeners.delete(listener);
  }

  public async getMcpManager(): Promise<McpManager> {
    await this.ensureDefaultAgent();
    return this.defaultManager!;
  }

  public async close(): Promise<void> {
    this.queue.kill();
    await this.resetAgent();
    this.activeJob = null;
  }

  private async resetAgent(): Promise<void> {
    await this.defaultManager?.disconnect().catch(() => undefined);
    this.defaultManager = null;
    this.defaultAgent = null;
  }

  private async notifyReset(): Promise<void> {
    await Promise.all([...this.resetListeners].map((listener) => listener()));
  }

  private async ensureDefaultAgent(): Promise<WorkerAgent> {
    if (this.defaultAgent) {
      return this.defaultAgent;
    }
    const {
      agent,
      mcp: { manager },
    } = await bootstrap("daemon", {}, false);
    this.defaultAgent = agent;
    this.defaultManager = manager;
    return agent;
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
    let cleanupHook: (() => void) | undefined;
    try {
      agent = job.agent ?? (await this.ensureDefaultAgent());
      this.activeAgent = agent;
      cleanupHook = agent.addHook(
        BeforeToolCallEvent as never,
        createApprovalHandler(job.approval, {
          yolo: () => Boolean(job.yolo),
        }) as never,
      );
      this.applyJobState(agent, job);
      job.onStart?.(agent);
      for await (const event of agent.stream(job.input)) {
        job.onStreamEvent?.(event, agent);
      }
      job.onSuccess?.(agent);
    } catch (error) {
      job.onError?.(error);
    } finally {
      cleanupHook?.();
      if (agent) {
        job.onComplete?.(agent);
        if (!job.agent && consumeExitRequest(agent)) {
          await this.resetAgent();
          await this.notifyReset();
          await job.onExit?.();
        }
      }
      if (this.activeJob?.id === job.id) {
        this.activeJob = null;
      }
      if (this.activeAgent === agent) {
        this.activeAgent = null;
      }
    }
  }
}
