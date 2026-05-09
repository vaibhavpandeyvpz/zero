import type {
  ApprovalDecision,
  AttachmentUploadResponse,
  ChannelModeStatus,
  ChatModelRequest,
  ChatSendRequest,
  ChatSessionMode,
  ChatSessionSnapshot,
  ChatStreamEvent,
  HealthResponse,
  McpServerView,
  McpUpsertRequest,
  SkillSearchResponse,
  SkillsResponse,
  WikiDocRecord,
  WikiListResult,
  ZeroConfigResponse,
} from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text || `${res.status} ${res.statusText}`;
    try {
      const data = JSON.parse(text) as { error?: string };
      message = data.error ?? message;
    } catch {
      // Keep the original response text when the body is not JSON.
    }
    throw new Error(message);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health");
}

export function getConfig(): Promise<ZeroConfigResponse> {
  return request<ZeroConfigResponse>("/api/config");
}

export function saveConfig(
  patch: Partial<ZeroConfigResponse["config"]> & { instructions?: string },
): Promise<ZeroConfigResponse> {
  return request<ZeroConfigResponse>("/api/config", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function sendMessage(
  body: ChatSendRequest,
): Promise<{ session: ChatSessionSnapshot }> {
  return request<{ session: ChatSessionSnapshot }>("/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function uploadAttachments(
  files: File[],
): Promise<AttachmentUploadResponse> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  const res = await fetch("/api/attachments", {
    method: "POST",
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    try {
      const data = JSON.parse(text) as { error?: string };
      throw new Error(data.error ?? text);
    } catch {
      throw new Error(text || `${res.status} ${res.statusText}`);
    }
  }
  return text
    ? (JSON.parse(text) as AttachmentUploadResponse)
    : { attachments: [] };
}

export async function streamMessage(
  body: ChatSendRequest,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text) as { error?: string };
      throw new Error(data.error ?? text);
    } catch {
      throw new Error(text || `${res.status} ${res.statusText}`);
    }
  }
  if (!res.body) {
    throw new Error("Chat stream response did not include a body.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) {
        onEvent(JSON.parse(line) as ChatStreamEvent);
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    onEvent(JSON.parse(buffer) as ChatStreamEvent);
  }
}

export function getChatSession(
  sessionId: string,
): Promise<{ session: ChatSessionSnapshot }> {
  return request<{ session: ChatSessionSnapshot }>(
    `/api/chat/${encodeURIComponent(sessionId)}`,
  );
}

export function cancelChat(
  sessionId: string,
): Promise<{ session: ChatSessionSnapshot }> {
  return request<{ session: ChatSessionSnapshot }>(
    `/api/chat/${encodeURIComponent(sessionId)}/cancel`,
    { method: "POST" },
  );
}

export function decideApproval(
  sessionId: string,
  decision: ApprovalDecision,
): Promise<{ session: ChatSessionSnapshot }> {
  return request<{ session: ChatSessionSnapshot }>(
    `/api/chat/${encodeURIComponent(sessionId)}/approval`,
    {
      method: "POST",
      body: JSON.stringify({ decision }),
    },
  );
}

export function setChatModel(
  sessionId: string,
  body: ChatModelRequest,
): Promise<{ session: ChatSessionSnapshot }> {
  return request<{ session: ChatSessionSnapshot }>(
    `/api/chat/${encodeURIComponent(sessionId)}/model`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function setChatYolo(
  sessionId: string,
  body: { yolo: boolean },
): Promise<{ session: ChatSessionSnapshot }> {
  return request<{ session: ChatSessionSnapshot }>(
    `/api/chat/${encodeURIComponent(sessionId)}/yolo`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function setChatSessionMode(
  sessionId: string,
  body: { mode: ChatSessionMode },
): Promise<{ session: ChatSessionSnapshot }> {
  return request<{ session: ChatSessionSnapshot }>(
    `/api/chat/${encodeURIComponent(sessionId)}/session-mode`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function setDaemonMode(enabled: boolean): Promise<ChannelModeStatus> {
  return request<ChannelModeStatus>("/api/channels/daemon", {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}

export function listMcp(): Promise<{ servers: McpServerView[] }> {
  return request<{ servers: McpServerView[] }>("/api/mcp");
}

export function addMcp(
  body: McpUpsertRequest,
): Promise<{ servers: McpServerView[] }> {
  return request<{ servers: McpServerView[] }>("/api/mcp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateMcp(
  name: string,
  body: Pick<McpUpsertRequest, "transport">,
): Promise<{ servers: McpServerView[] }> {
  return request<{ servers: McpServerView[] }>(
    `/api/mcp/${encodeURIComponent(name)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function removeMcp(name: string): Promise<{ servers: McpServerView[] }> {
  return request<{ servers: McpServerView[] }>(
    `/api/mcp/${encodeURIComponent(name)}`,
    { method: "DELETE" },
  );
}

export function listSkills(): Promise<SkillsResponse> {
  return request<SkillsResponse>("/api/skills");
}

export function searchSkills(query: string): Promise<SkillSearchResponse> {
  return request<SkillSearchResponse>(
    `/api/skills/search?q=${encodeURIComponent(query)}`,
  );
}

export function installSkill(source: string): Promise<SkillsResponse> {
  return request<SkillsResponse>("/api/skills", {
    method: "POST",
    body: JSON.stringify({ source }),
  });
}

export function removeSkill(folder: string): Promise<SkillsResponse> {
  return request<SkillsResponse>(`/api/skills/${encodeURIComponent(folder)}`, {
    method: "DELETE",
  });
}

export function restartServices(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/api/services/restart", { method: "POST" });
}

export function getWikiDocuments(
  page = 1,
  pageSize = 20,
): Promise<WikiListResult> {
  const q = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return request<WikiListResult>(`/api/wiki/documents?${q}`).then((raw) => {
    const items = Array.isArray(raw.items) ? raw.items : [];
    const safePage =
      typeof raw.page === "number" && Number.isFinite(raw.page) && raw.page > 0
        ? Math.floor(raw.page)
        : page;
    const safeSize =
      typeof raw.pageSize === "number" &&
      Number.isFinite(raw.pageSize) &&
      raw.pageSize > 0
        ? Math.floor(raw.pageSize)
        : pageSize;
    const base = { page: safePage, pageSize: safeSize, items };
    if (
      typeof raw.total === "number" &&
      Number.isFinite(raw.total) &&
      raw.total >= 0
    ) {
      return { ...base, total: raw.total } as WikiListResult;
    }
    return base as WikiListResult;
  });
}

export async function uploadWikiDocument(
  file: File,
): Promise<{ doc: WikiDocRecord }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/wiki/documents", {
    method: "POST",
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text || `${res.status} ${res.statusText}`;
    try {
      const data = JSON.parse(text) as { error?: string };
      message = data.error ?? message;
    } catch {
      // keep message
    }
    throw new Error(message);
  }
  return text
    ? (JSON.parse(text) as { doc: WikiDocRecord })
    : ({} as { doc: WikiDocRecord });
}

export async function deleteWikiDocument(docId: string): Promise<void> {
  const res = await fetch(`/api/wiki/documents/${encodeURIComponent(docId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text || `${res.status} ${res.statusText}`;
    try {
      const data = JSON.parse(text) as { error?: string };
      message = data.error ?? message;
    } catch {
      // keep message
    }
    throw new Error(message);
  }
}
