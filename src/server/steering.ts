import {
  InterventionActions,
  type AfterModelCallEvent,
  type BeforeToolCallEvent,
} from "@strands-agents/sdk";
import { SteeringHandler } from "@strands-agents/sdk/vended-interventions/steering";

export type QueuedSteeringPrompt = {
  text: string;
  attachments: string[];
};

function formatSteeringPrompt(prompt: QueuedSteeringPrompt): string {
  const text = prompt.text.trim();
  if (prompt.attachments.length === 0) {
    return text || "[empty prompt]";
  }
  const attachmentLines = prompt.attachments.map(
    (path) => `[attachment] ${path}`,
  );
  return [text || "[attachments only]", ...attachmentLines].join("\n");
}

function buildSteeringFeedback(
  prompts: readonly QueuedSteeringPrompt[],
): string {
  const guidance = prompts
    .map((prompt, index) => `${index + 1}. ${formatSteeringPrompt(prompt)}`)
    .join("\n\n");
  return [
    "The user sent follow-up guidance while this turn was still running.",
    "Update your plan before continuing. Treat the following as current user steering:",
    guidance,
  ].join("\n\n");
}

/**
 * Buffers messages sent while a turn is already streaming, so they can be
 * injected into the *running* turn instead of waiting in line for a brand
 * new one. Mirrors hoomanjs's own chat UI (`src/chat/steering.ts`), which
 * isn't part of the public hoomanjs API — built directly on the
 * `@strands-agents/sdk` steering intervention it uses under the hood.
 */
export class ChatTurnSteeringController {
  private readonly queued: QueuedSteeringPrompt[] = [];

  public queue(prompts: readonly QueuedSteeringPrompt[]): boolean {
    if (prompts.length === 0) {
      return false;
    }
    this.queued.push(...prompts);
    return true;
  }

  public get hasPending(): boolean {
    return this.queued.length > 0;
  }

  public drainFeedback(): string | null {
    if (this.queued.length === 0) {
      return null;
    }
    const prompts = this.queued.splice(0, this.queued.length);
    return buildSteeringFeedback(prompts);
  }
}

export class ChatTurnSteeringIntervention extends SteeringHandler {
  public readonly name = "zero:chat-turn-steering";

  public constructor(private readonly controller: ChatTurnSteeringController) {
    super();
  }

  public override beforeToolCall(_event: BeforeToolCallEvent) {
    const feedback = this.controller.drainFeedback();
    return feedback
      ? InterventionActions.guide(feedback)
      : InterventionActions.proceed();
  }

  public override afterModelCall(event: AfterModelCallEvent) {
    if (!event.stopData) {
      return InterventionActions.proceed();
    }
    const feedback = this.controller.drainFeedback();
    return feedback
      ? InterventionActions.guide(feedback)
      : InterventionActions.proceed();
  }
}

export function createChatTurnSteeringIntervention(
  controller: ChatTurnSteeringController,
): ChatTurnSteeringIntervention {
  return new ChatTurnSteeringIntervention(controller);
}
