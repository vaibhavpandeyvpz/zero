import {
  TOOL_APPROVAL_INTERNAL_ALWAYS_ALLOWED,
  allowToolForSession,
  isToolSessionAllowed,
  isYoloEnabled,
} from "hoomanjs";
import type { ApprovalDecision, ApprovalRequest } from "../client/types.js";

export type ApprovalToolCallEvent = {
  toolUse: {
    name: string;
    input: unknown;
  };
  tool?: {
    description?: string;
  };
  agent: Parameters<typeof isToolSessionAllowed>[0];
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
    if (
      !controller ||
      isYoloEnabled(event.agent) ||
      TOOL_APPROVAL_INTERNAL_ALWAYS_ALLOWED.has(toolName) ||
      isToolSessionAllowed(event.agent, toolName)
    ) {
      return;
    }

    const decision = await controller.request(event);
    if (decision === "allow") {
      return;
    }
    if (decision === "always") {
      allowToolForSession(event.agent, toolName);
      return;
    }
    event.cancel = `Tool "${toolName}" was rejected by the user.`;
  };
}
