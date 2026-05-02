import crypto from "node:crypto";
import {
  HOOMAN_CHANNEL,
  type ChannelSubscription,
  type ChannelSubscriptionHandle,
} from "hoomanjs";
import type { ChannelModeStatus } from "../client/types.js";
import { AgentWorker } from "./agent-worker.js";
import {
  channelMessageInput,
  channelOrigin,
  resolveChannelSessionId,
  resolveChannelUserId,
} from "./agents/channel-message.js";
import type { ChannelMessage } from "hoomanjs";

export class ChannelMode {
  private handle: ChannelSubscriptionHandle | null = null;
  private enabled = false;
  private running = false;
  private processed = 0;
  private subscriptions: ChannelSubscription[] = [];
  private lastMessageAt: string | undefined;
  private lastError: string | undefined;

  public constructor(private readonly worker: AgentWorker) {
    this.worker.onReset(() => {
      if (this.running) {
        this.lastError =
          "Agent stopped. Turn channel input on again to resubscribe.";
        void this.stop();
      }
    });
  }

  public status(): ChannelModeStatus {
    const workerStatus = this.worker.status();
    return {
      enabled: this.enabled,
      running: this.running,
      subscriptions: this.subscriptions,
      queued: workerStatus.queued,
      processed: this.processed,
      lastMessageAt: this.lastMessageAt,
      lastError: this.lastError,
      yolo: this.worker.getDefaultYolo(),
    };
  }

  public async setEnabled(enabled: boolean): Promise<ChannelModeStatus> {
    if (enabled) {
      await this.start();
    } else {
      await this.stop();
    }
    return this.status();
  }

  public async start(): Promise<void> {
    if (this.running) {
      this.enabled = true;
      return;
    }
    this.enabled = true;
    this.lastError = undefined;
    try {
      const manager = await this.worker.getMcpManager();
      this.handle = await manager.subscribeToChannels(
        [HOOMAN_CHANNEL],
        (message) => {
          this.lastMessageAt = new Date().toISOString();
          void this.handleMessage(message).catch((error) => {
            this.lastError =
              error instanceof Error ? error.message : String(error);
          });
        },
      );
      this.subscriptions = this.handle.subscriptions;
      this.running = true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      await this.stop();
      this.enabled = true;
    }
  }

  public async stop(): Promise<void> {
    this.enabled = false;
    this.running = false;
    this.handle?.unsubscribe();
    this.handle = null;
    this.subscriptions = [];
  }

  private async handleMessage(message: ChannelMessage): Promise<void> {
    const session = resolveChannelSessionId(message);
    const user = resolveChannelUserId(message, session);

    await this.worker.enqueue({
      id: `${Date.now().toString(36)}-${crypto.randomUUID()}`,
      source: "channel",
      sessionId: session,
      userId: user,
      origin: channelOrigin(message),
      input: await channelMessageInput(message),
      yolo: this.worker.getDefaultYolo(),
      onSuccess: () => {
        this.processed += 1;
      },
      onError: (error) => {
        this.lastError = error instanceof Error ? error.message : String(error);
      },
      onExit: () => this.stop(),
    });
  }
}
