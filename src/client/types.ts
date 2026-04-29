import type {
  ConfigData,
  FileToolDisplay,
  McpTransport,
  NamedMcpTransport,
  SkillListEntry,
  SkillSearchResult,
  TodoViewState,
} from "hoomanjs";

export type NoticeKind = "success" | "error" | "info";

export type ZeroPaths = {
  root: string;
  config: string;
  instructions: string;
  mcp: string;
  skills: string;
  sessions: string;
  attachments: string;
};

export type ZeroConfigResponse = {
  config: ConfigData;
  maskedLlmParams: unknown;
  instructions: string;
  paths: ZeroPaths;
};

export type McpServerView = NamedMcpTransport & {
  summary: string;
};

export type SkillsResponse = {
  skills: SkillListEntry[];
};

export type SkillSearchResponse = {
  results: SkillSearchResult[];
};

export type HealthResponse = {
  ok: true;
  name: string;
  version: string;
  daemonEnabled: boolean;
  daemonStatus: ChannelModeStatus;
  paths: ZeroPaths;
};

export type ChannelModeStatus = {
  enabled: boolean;
  running: boolean;
  subscriptions: Array<{ server: string; channel: string }>;
  queued: number;
  processed: number;
  lastMessageAt?: string;
  lastError?: string;
};

export type ChatRole = "user" | "assistant" | "system" | "tool";

export type ChatLine = {
  id: string;
  role: ChatRole;
  content: string;
  title?: string;
  toolName?: string;
  phase?: "running" | "done";
  resultContent?: string;
  reasoningContent?: string;
  fileToolDisplay?: FileToolDisplay;
  done: boolean;
};

export type ApprovalRequest = {
  id: string;
  toolName: string;
  description?: string;
  inputPreview: string;
};

export type ChatSessionSnapshot = {
  sessionId: string;
  running: boolean;
  queued: Array<{ id: string; text: string; attachments: string[] }>;
  lines: ChatLine[];
  pendingApproval: ApprovalRequest | null;
  status: string;
  todos?: TodoViewState;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
  };
};

export type ChatSendRequest = {
  text: string;
  attachments?: string[];
  sessionId?: string;
  yolo?: boolean;
};

export type UploadedAttachment = {
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
};

export type AttachmentUploadResponse = {
  attachments: UploadedAttachment[];
};

export type ChatSendResponse = {
  session: ChatSessionSnapshot;
};

export type ApprovalDecision = "allow" | "always" | "deny";

export type ChatStreamEvent =
  | { type: "user.message"; line: ChatLine }
  | { type: "assistant.created"; line: ChatLine }
  | { type: "turn.queued"; queued: ChatSessionSnapshot["queued"] }
  | { type: "turn.started"; queued: ChatSessionSnapshot["queued"] }
  | { type: "reasoning.delta"; lineId: string; text: string }
  | { type: "assistant.delta"; lineId: string; text: string }
  | { type: "tool.started"; line: ChatLine; assistantLineId?: string }
  | {
      type: "tool.result";
      lineId: string;
      resultContent: string;
      fileToolDisplay?: FileToolDisplay;
    }
  | { type: "todos.updated"; todos: TodoViewState }
  | {
      type: "usage.updated";
      usage: NonNullable<ChatSessionSnapshot["usage"]>;
    }
  | { type: "approval.request"; request: ApprovalRequest }
  | { type: "approval.cleared" }
  | {
      type: "turn.completed";
      assistantLineId: string;
      usage?: ChatSessionSnapshot["usage"];
      todos?: TodoViewState;
    }
  | { type: "turn.error"; message: string; line: ChatLine };

export type McpUpsertRequest = {
  name: string;
  transport: McpTransport;
};
