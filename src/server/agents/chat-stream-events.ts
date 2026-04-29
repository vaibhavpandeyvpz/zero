export type ModelDelta = {
  type?: string;
  text?: string;
};

export type StreamEvent = {
  type?: string;
  contentBlock?: unknown;
  result?: unknown;
  event?: { type?: string; usage?: unknown; metrics?: unknown; delta?: ModelDelta };
};

export function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

export function getToolUseId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as { toolUseId?: unknown; id?: unknown };
  return typeof record.toolUseId === "string"
    ? record.toolUseId
    : typeof record.id === "string"
      ? record.id
      : undefined;
}

export function toToolResultText(result: unknown): string {
  if (!result || typeof result !== "object") {
    return stringifyUnknown(result);
  }
  const content = (result as { content?: unknown }).content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item || typeof item !== "object") return stringifyUnknown(item);
        const record = item as { text?: unknown; content?: unknown };
        return typeof record.text === "string"
          ? record.text
          : stringifyUnknown(record.content ?? item);
      })
      .join("\n");
  }
  return stringifyUnknown(result);
}
