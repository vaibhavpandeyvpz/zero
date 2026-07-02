import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TodoViewState } from "hoomanjs";
import { sessionsPath } from "../lib/paths.js";
import type {
  ChatLine,
  ChatSessionMode,
  ChatSessionSnapshot,
  ChatSessionSummary,
  ReasoningEffortLevel,
} from "../client/types.js";

const TRANSCRIPT_FILE = "zero-chat.json";
const TITLE_MAX_LENGTH = 80;

/** On-disk shape of a chat session's UI transcript (lines the agent's raw message snapshot doesn't capture). */
export type PersistedChatSession = {
  sessionId: string;
  lines: ChatLine[];
  yolo: boolean;
  sessionMode: ChatSessionMode;
  model?: string;
  reasoningEffort?: ReasoningEffortLevel;
  todos?: TodoViewState;
  usage?: ChatSessionSnapshot["usage"];
  updatedAt: string;
};

function sessionDirPath(sessionId: string): string {
  return join(sessionsPath(), sessionId);
}

function transcriptFilePath(sessionId: string): string {
  return join(sessionDirPath(sessionId), TRANSCRIPT_FILE);
}

export async function loadPersistedSession(
  sessionId: string,
): Promise<PersistedChatSession | null> {
  try {
    const raw = await readFile(transcriptFilePath(sessionId), "utf8");
    return JSON.parse(raw) as PersistedChatSession;
  } catch {
    return null;
  }
}

export async function savePersistedSession(
  data: PersistedChatSession,
): Promise<void> {
  await mkdir(sessionDirPath(data.sessionId), { recursive: true });
  await writeFile(
    transcriptFilePath(data.sessionId),
    JSON.stringify(data, null, 2),
    "utf8",
  );
}

/** Removes the whole session directory, taking the agent's own raw snapshot with it. */
export async function deletePersistedSession(sessionId: string): Promise<void> {
  await rm(sessionDirPath(sessionId), { recursive: true, force: true });
}

export function deriveSessionTitle(lines: ChatLine[] | undefined): string {
  const userLine = lines?.find((line) => line.role === "user" && line.content);
  if (!userLine) {
    return "Untitled session";
  }
  const text = userLine.content.split("\n\n[attachment]")[0]?.trim() ?? "";
  const firstLine = text.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (!firstLine) {
    return "Untitled session";
  }
  return firstLine.length > TITLE_MAX_LENGTH
    ? `${firstLine.slice(0, TITLE_MAX_LENGTH - 3)}...`
    : firstLine;
}

export async function listPersistedSessions(): Promise<ChatSessionSummary[]> {
  let entries: string[];
  try {
    entries = (await readdir(sessionsPath(), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
  const summaries = await Promise.all(
    entries.map(async (sessionId): Promise<ChatSessionSummary | null> => {
      const data = await loadPersistedSession(sessionId);
      if (!data) {
        return null;
      }
      return {
        sessionId: data.sessionId,
        title: deriveSessionTitle(data.lines),
        updatedAt: data.updatedAt,
        messageCount: data.lines.length,
      };
    }),
  );
  return summaries
    .filter((summary): summary is ChatSessionSummary => summary !== null)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
