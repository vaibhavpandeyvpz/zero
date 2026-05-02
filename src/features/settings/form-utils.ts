import {
  parse as parseShellCommand,
  quote as quoteShellCommand,
} from "shell-quote";
import type { McpServerView } from "@/client/types";

type McpTransportDraft = McpServerView["transport"];

export type KeyValueEntry = { key: string; value: string };

export type SkillInstallCandidate = {
  name: string;
  source: string;
  details?: string;
};

type ValidationIssue = {
  path?: Array<string | number>;
  message?: string;
};

export function skillFolder(path: string): string {
  return path.split("/").at(-2) ?? path;
}

export function entriesToStringMap(
  entries: KeyValueEntry[],
  label: string,
): Record<string, string> | undefined {
  const map: Record<string, string> = {};

  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) {
      if (entry.value.trim()) {
        throw new Error(`${label} entries with values need keys.`);
      }
      continue;
    }
    map[key] = entry.value;
  }

  return Object.keys(map).length > 0 ? map : undefined;
}

export function stringMapToEntries(
  value: Record<string, string> | undefined,
): KeyValueEntry[] {
  return value
    ? Object.entries(value).map(([key, entryValue]) => ({
        key,
        value: entryValue,
      }))
    : [];
}

export function formatMcpCommandLine(
  command: string,
  args: string[] | undefined,
): string {
  return quoteShellCommand([command, ...(args ?? [])]);
}

export function parseMcpCommandLine(
  commandLine: string,
): Pick<Extract<McpTransportDraft, { type: "stdio" }>, "command" | "args"> {
  const parsed = parseShellCommand(commandLine, (key) => `$${key}`);
  if (parsed.length === 0) {
    throw new Error("Command is required.");
  }
  if (!parsed.every((entry): entry is string => typeof entry === "string")) {
    throw new Error(
      "Command cannot include shell operators, redirects, comments, or globs.",
    );
  }

  const [command, ...args] = parsed;
  if (!command?.trim()) {
    throw new Error("Command is required.");
  }

  return {
    command,
    args: args.length > 0 ? args : undefined,
  };
}

function prettyIssuePath(path: ValidationIssue["path"]): string {
  if (!path || path.length === 0) return "Configuration";
  return path
    .map((part) =>
      String(part)
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[-_]/g, " "),
    )
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function configErrorMessages(error: unknown): string[] {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const parsed = tryParseJson(rawMessage);
  const value =
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "error" in parsed
      ? (tryParseJson(String((parsed as { error: unknown }).error)) ??
        String((parsed as { error: unknown }).error))
      : (parsed ?? rawMessage);

  if (Array.isArray(value)) {
    const issues = value as ValidationIssue[];
    return issues.map((issue) => {
      const message = issue.message ?? "Invalid value.";
      return `${prettyIssuePath(issue.path)}: ${message}`;
    });
  }

  return [typeof value === "string" ? value : rawMessage];
}
