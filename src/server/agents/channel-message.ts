import { TextBlock } from "@strands-agents/sdk";
import { attachmentPathsToPromptBlocks, type ChannelMessage } from "hoomanjs";
import type { AgentWorkerInput } from "./worker.js";

const MAX_ATTACHMENT_BYTES = 1024 * 1024;

export function resolveChannelSessionId(
  message: ChannelMessage,
  fallback?: string,
): string | undefined {
  const raw = message.meta.session?.trim() || fallback;
  if (!raw) return undefined;
  return `${message.meta.subscription.server}:${message.meta.subscription.channel}:${raw}`;
}

export function resolveChannelUserId(
  message: ChannelMessage,
  session?: string,
): string | undefined {
  const raw = message.meta.user?.trim();
  return raw ? `${message.meta.subscription.server}:${raw}` : session;
}

export function channelOrigin(
  message: ChannelMessage,
): Record<string, unknown> {
  return {
    server: message.meta.subscription.server,
    channel: message.meta.subscription.channel,
    ...(message.meta.source ? { source: message.meta.source } : {}),
    ...(message.meta.user ? { user: message.meta.user } : {}),
    ...(message.meta.session ? { session: message.meta.session } : {}),
    ...(message.meta.thread ? { thread: message.meta.thread } : {}),
  };
}

export async function channelMessageInput(
  message: ChannelMessage,
): Promise<AgentWorkerInput> {
  if (message.attachments.length === 0) {
    return message.prompt;
  }
  const blocks = [
    new TextBlock(message.prompt),
    ...(await attachmentPathsToPromptBlocks(message.attachments, {
      maxBytes: MAX_ATTACHMENT_BYTES,
    })),
  ];
  return blocks as AgentWorkerInput;
}
