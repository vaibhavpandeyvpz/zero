import {
  HoomanToolApprovalIntervention,
  createChannelPermissionAsk,
  type McpManager,
  type ToolApprovalRequest,
} from "hoomanjs";
import type { ApprovalDecision, ApprovalRequest } from "../client/types.js";

type QueueItem = {
  request: ApprovalRequest;
  /** Correlates the request back to the tool-call chat line it was raised for. */
  toolUseId?: string;
  resolve: (decision: ApprovalDecision) => void;
};

export class ApprovalController {
  private readonly queue: QueueItem[] = [];
  private nextId = 0;

  public constructor(
    private readonly onChange: () => void = () => {},
    /** Called synchronously once a request is queued, before `ask` awaits a decision. */
    private readonly onRequested?: (
      request: ApprovalRequest,
      toolUseId?: string,
    ) => void,
  ) {}

  public get pending(): ApprovalRequest | null {
    return this.queue[0]?.request ?? null;
  }

  public request(
    toolRequest: ToolApprovalRequest,
    toolUseId?: string,
  ): Promise<ApprovalDecision> {
    const request: ApprovalRequest = {
      id: String(this.nextId++),
      toolName: toolRequest.toolName,
      description: toolRequest.description,
      inputPreview: toolRequest.inputPreview,
      preview: toolRequest.preview,
    };
    this.onRequested?.(request, toolUseId);
    return new Promise<ApprovalDecision>((resolve) => {
      this.queue.push({ request, toolUseId, resolve });
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

/**
 * Wraps Zero's in-app approval dialog in hoomanjs's own tool-approval
 * intervention, which already handles the auto-approve checks (yolo, plan
 * mode, implicit allowlist, "always allow" persistence) upstream of `ask`.
 */
export function createApprovalIntervention(
  controller: ApprovalController,
): HoomanToolApprovalIntervention {
  return new HoomanToolApprovalIntervention({
    ask: async (request, event) => {
      const decision = await controller.request(
        request,
        event.toolUse.toolUseId,
      );
      if (decision === "deny") {
        return {
          decision: "reject",
          reason: `Tool "${request.toolName}" was rejected by the user.`,
        };
      }
      return decision;
    },
  });
}

/**
 * Approval intervention for tool calls originating from channel messages
 * (Slack, Discord, etc. via MCP). Delegates to hoomanjs's
 * `hooman/channel/permission` round-trip, which prompts back over the
 * originating MCP server instead of Zero's own in-app dialog (which has no
 * UI surface for a headless channel message).
 */
export function createChannelApprovalIntervention(
  manager: McpManager,
): HoomanToolApprovalIntervention {
  return new HoomanToolApprovalIntervention({
    ask: createChannelPermissionAsk(manager),
  });
}
