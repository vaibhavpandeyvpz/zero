import type { McpTransport } from "hoomanjs";

const MASKED_PARAM_KEYS = new Set(["apikey", "clientconfig"]);

export const DEFAULT_INSTRUCTIONS = `You are a helpful assistant.`;

export function maskSensitiveParamsForDisplay(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveParamsForDisplay(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, itemValue] of Object.entries(value)) {
    output[key] = MASKED_PARAM_KEYS.has(key.toLowerCase())
      ? "[REDACTED]"
      : maskSensitiveParamsForDisplay(itemValue);
  }
  return output;
}

export function parseJsonObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

export function normalizeString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty.`);
  }
  return trimmed;
}

export function transportSummary(transport: McpTransport): string {
  switch (transport.type) {
    case "stdio":
      return `Local command - ${transport.command}`;
    case "streamable-http":
      return `Remote server - ${transport.url}`;
    case "sse":
      return `Event stream - ${transport.url}`;
    default: {
      const exhaustive: never = transport;
      return String(exhaustive);
    }
  }
}
