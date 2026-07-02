import crypto from "node:crypto";
import {
  TOOL_APPROVAL_INTERNAL_ALWAYS_ALLOWED,
  getAllowlist,
  isImplicitlyAllowed,
  isYoloEnabled,
  planModeWriteEditRejectionMessage,
  type McpManager,
} from "hoomanjs";
import type { ApprovalDecision, ApprovalRequest } from "../client/types.js";

/**
 * Structurally compatible with the various (near-identical, module-local)
 * `AgentLike` types hoomanjs exports from `core/state/*` — using the generic
 * `get<T>` shape here keeps this assignable to all of them.
 */
type AgentAppState = {
  appState: {
    get<T = unknown>(key: string): T;
    set(key: string, value: unknown): void;
  };
};

export type ApprovalToolCallEvent = {
  toolUse: {
    name: string;
    input: unknown;
  };
  tool?: {
    description?: string;
  };
  agent: AgentAppState;
  cancel?: string;
};

const INPUT_PREVIEW_LIMIT = 256;

function previewInput(input: unknown): string {
  try {
    const text = JSON.stringify(input, null, 2) ?? "null";
    return text.length > INPUT_PREVIEW_LIMIT
      ? `${text.slice(0, INPUT_PREVIEW_LIMIT)}\n... (truncated)`
      : text;
  } catch {
    return String(input);
  }
}

type QueueItem = {
  request: ApprovalRequest;
  resolve: (decision: ApprovalDecision) => void;
};

export class ApprovalController {
  private readonly queue: QueueItem[] = [];
  private nextId = 0;

  public constructor(private readonly onChange: () => void = () => {}) {}

  public get pending(): ApprovalRequest | null {
    return this.queue[0]?.request ?? null;
  }

  public request(event: ApprovalToolCallEvent): Promise<ApprovalDecision> {
    const request: ApprovalRequest = {
      id: String(this.nextId++),
      toolName: event.toolUse.name,
      description: event.tool?.description?.trim(),
      inputPreview: previewInput(event.toolUse.input),
    };
    return new Promise<ApprovalDecision>((resolve) => {
      this.queue.push({ request, resolve });
      this.onChange();
    });
  }

  public decide(decision: ApprovalDecision): boolean {
    const item = this.queue.shift();
    if (!item) {
      return false;
    }
    item.resolve(decision);
    this.onChange();
    return true;
  }
}

export function createApprovalHandler(
  controller: ApprovalController | null | undefined,
): (event: ApprovalToolCallEvent) => Promise<void> {
  return async (event: ApprovalToolCallEvent) => {
    const toolName = event.toolUse.name;
    const planReject = planModeWriteEditRejectionMessage(
      event.agent,
      toolName,
      event.toolUse.input,
    );
    if (planReject) {
      event.cancel = planReject;
      return;
    }
    if (
      !controller ||
      isYoloEnabled(event.agent) ||
      TOOL_APPROVAL_INTERNAL_ALWAYS_ALLOWED.has(toolName) ||
      isImplicitlyAllowed(toolName, event.toolUse.input) ||
      getAllowlist().isAllowed(toolName, event.toolUse.input)
    ) {
      return;
    }

    const decision = await controller.request(event);
    if (decision === "allow") {
      return;
    }
    if (decision === "always") {
      // Persisted disk-backed allowlist (`~/.zero/allowlist.json`), shared across
      // every chat/channel session — not scoped to this session like before.
      getAllowlist().allowAlways(toolName, event.toolUse.input);
      return;
    }
    event.cancel = `Tool "${toolName}" was rejected by the user.`;
  };
}

const CHANNEL_DESCRIPTION_PREVIEW_LIMIT = 200;

type ChannelOrigin = {
  server?: string;
  source?: string;
  user?: string;
  session?: string;
  thread?: string;
};

function readChannelOrigin(agent: AgentAppState): ChannelOrigin | null {
  const raw = agent.appState.get<unknown>("origin");
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entry = raw as Record<string, unknown>;
  const text = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.trim() : undefined;
  return {
    server: text(entry.server),
    source: text(entry.source),
    user: text(entry.user),
    session: text(entry.session),
    thread: text(entry.thread),
  };
}

/**
 * Approval handler for tool calls originating from channel messages (Slack,
 * Discord, etc. via MCP). New in hoomanjs 1.3x: `manager.requestChannelPermission`
 * round-trips an allow/deny prompt back over the originating MCP server's
 * `hooman/channel/permission` capability, instead of Zero's own in-app dialog
 * (which has no UI surface for a headless channel message).
 *
 * Falls back to the same legacy “allow” behavior as before when the
 * originating server doesn’t advertise support for that capability, so
 * existing channel setups keep working unchanged.
 */
export function createChannelApprovalHandler(
  manager: McpManager,
): (event: ApprovalToolCallEvent) => Promise<void> {
  return async (event: ApprovalToolCallEvent) => {
    const toolName = event.toolUse.name;
    const planReject = planModeWriteEditRejectionMessage(
      event.agent,
      toolName,
      event.toolUse.input,
    );
    if (planReject) {
      event.cancel = planReject;
      return;
    }
    if (
      isYoloEnabled(event.agent) ||
      TOOL_APPROVAL_INTERNAL_ALWAYS_ALLOWED.has(toolName) ||
      isImplicitlyAllowed(toolName, event.toolUse.input) ||
      getAllowlist().isAllowed(toolName, event.toolUse.input)
    ) {
      return;
    }

    const origin = readChannelOrigin(event.agent);
    if (!origin?.server) {
      return;
    }
    const supported = await manager
      .supportsChannelPermission(origin.server)
      .catch(() => false);
    if (!supported) {
      return;
    }

    try {
      const behavior = await manager.requestChannelPermission(origin.server, {
        requestId: crypto.randomUUID(),
        tool: toolName,
        description: (
          event.tool?.description?.trim() || `Run tool "${toolName}".`
        ).slice(0, CHANNEL_DESCRIPTION_PREVIEW_LIMIT),
        preview: previewInput(event.toolUse.input),
        source: origin.source,
        user: origin.user,
        session: origin.session,
        thread: origin.thread,
      });
      if (behavior === "allow_once") {
        return;
      }
      if (behavior === "allow_always") {
        getAllowlist().allowAlways(toolName, event.toolUse.input);
        return;
      }
      event.cancel = `Tool "${toolName}" was rejected by remote approval.`;
    } catch (error) {
      event.cancel = `Tool "${toolName}" was denied: failed to request permission (${
        error instanceof Error ? error.message : String(error)
      }).`;
    }
  };
}
