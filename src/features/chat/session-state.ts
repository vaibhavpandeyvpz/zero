import type {
  ChatLine,
  ChatSessionSnapshot,
  ChatStreamEvent,
} from "@/client/types";

export function newSessionId(): string {
  return crypto.randomUUID();
}

export function emptySession(sessionId: string): ChatSessionSnapshot {
  return {
    sessionId,
    running: false,
    yolo: false,
    sessionMode: "default",
    model: "unknown",
    models: [],
    queued: [],
    lines: [],
    approvals: null,
    status: "ready",
  };
}

function updateLine(
  lines: ChatLine[],
  lineId: string,
  patch: Partial<ChatLine>,
): ChatLine[] {
  return lines.map((line) =>
    line.id === lineId ? { ...line, ...patch } : line,
  );
}

function moveLineToEnd(lines: ChatLine[], lineId?: string): ChatLine[] {
  if (!lineId) return lines;
  const index = lines.findIndex((line) => line.id === lineId);
  if (index < 0 || index === lines.length - 1) return lines;
  const next = [...lines];
  const [line] = next.splice(index, 1);
  if (line) next.push(line);
  return next;
}

export function applyChatEvent(
  current: ChatSessionSnapshot | null,
  sessionId: string,
  event: ChatStreamEvent,
): ChatSessionSnapshot {
  const base = current ?? emptySession(sessionId);
  switch (event.type) {
    case "user.message":
      return { ...base, lines: [...base.lines, event.line] };
    case "assistant.created":
      return {
        ...base,
        running: true,
        status: "waiting in agent queue",
        lines: [...base.lines, event.line],
      };
    case "turn.queued":
      return {
        ...base,
        running: true,
        status: "waiting in agent queue",
        queued: event.queued,
      };
    case "turn.started":
      return {
        ...base,
        running: true,
        status: "thinking",
        queued: event.queued,
      };
    case "reasoning.delta":
      return {
        ...base,
        status: "thinking",
        lines: updateLine(base.lines, event.lineId, {
          reasoningContent: `${
            base.lines.find((line) => line.id === event.lineId)
              ?.reasoningContent ?? ""
          }${event.text}`,
        }),
      };
    case "assistant.delta": {
      const currentLine = base.lines.find((line) => line.id === event.lineId);
      return {
        ...base,
        status: "streaming",
        lines: moveLineToEnd(
          updateLine(base.lines, event.lineId, {
            content: `${currentLine?.content ?? ""}${event.text}`,
          }),
          event.lineId,
        ),
      };
    }
    case "tool.started":
      return {
        ...base,
        status: "running tool",
        lines: moveLineToEnd(
          [...base.lines, event.line],
          event.assistantLineId,
        ),
      };
    case "tool.result":
      return {
        ...base,
        lines: updateLine(base.lines, event.lineId, {
          phase: "done",
          done: true,
          resultContent: event.resultContent,
          fileToolDisplay: event.fileToolDisplay,
        }),
      };
    case "todos.updated":
      return { ...base, todos: event.todos };
    case "usage.updated":
      return { ...base, usage: event.usage };
    case "approval.request":
      return { ...base, approvals: event.request };
    case "approval.cleared":
      return { ...base, approvals: null };
    case "turn.completed":
      return {
        ...base,
        running: false,
        queued: [],
        status: "ready",
        approvals: null,
        todos: event.todos ?? base.todos,
        usage: event.usage ?? base.usage,
        lines: updateLine(
          base.lines.map((line) =>
            line.role === "tool" && line.phase === "running"
              ? { ...line, phase: "done", done: true }
              : line,
          ),
          event.assistantLineId,
          { done: true },
        ),
      };
    case "turn.error":
      return {
        ...base,
        running: false,
        status: "error",
        lines: [...base.lines, event.line],
      };
    default:
      return base;
  }
}
