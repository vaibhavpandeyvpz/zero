"use client";

import { useState } from "react";
import type { ChangeEvent, ClipboardEvent, DragEvent } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardListIcon,
  FileTextIcon,
  Loader2Icon,
  SendIcon,
  SparklesIcon,
  SquareIcon,
  UploadIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  ChannelModeStatus,
  ChatLine,
  ChatSessionMode,
  ChatSessionSnapshot,
  UploadedAttachment,
} from "@/client/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  attachmentPreviewUrl,
  isImageAttachment,
  parseMessageAttachments,
  type AttachmentPreview,
} from "./attachments";
import { useAutoScroll } from "./use-auto-scroll";
import { useTextareaAutosize } from "./use-textarea-autosize";

const MODE_SELECT_LABELS: Record<ChatSessionMode, string> = {
  default: "Default",
  plan: "Plan",
  ask: "Ask",
};

function modeSelectTriggerLabel(mode: ChatSessionMode): string {
  return `Mode · ${MODE_SELECT_LABELS[mode]}`;
}

function modelSelectTriggerLabel(
  models: ChatSessionSnapshot["models"],
  currentName: string,
): string | null {
  const entry = models.find((m) => m.name === currentName);
  return entry?.name ?? null;
}

export function ChatPanel(props: {
  session: ChatSessionSnapshot | null;
  agentName: string;
  input: string;
  setInput: (value: string) => void;
  attachments: UploadedAttachment[];
  uploadingAttachments: boolean;
  onAddAttachments: (files: File[]) => Promise<void>;
  onRemoveAttachment: (name: string) => void;
  daemon?: ChannelModeStatus;
  onSubmit: () => Promise<void>;
  onCancel: () => Promise<void>;
  onSetModel: (name: string) => Promise<void>;
  sessionMode: ChatSessionMode;
  onSetSessionMode: (mode: ChatSessionMode) => Promise<void>;
  yolo: boolean;
  onSetYolo: (enabled: boolean) => Promise<void>;
  onToggleDaemon: (enabled: boolean) => Promise<void>;
  onApprove: (decision: "allow" | "always" | "deny") => Promise<void>;
}) {
  const lines = props.session?.lines ?? [];
  const todos = props.session?.todos;
  const canSend = !props.uploadingAttachments;
  const scrollRef = useAutoScroll([lines.length, props.session?.status]);
  const textareaRef = useTextareaAutosize(props.input);

  return (
    <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-h-0 flex-col gap-4">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden pb-0">
          <CardHeader>
            <CardTitle>Chat</CardTitle>
            <CardDescription>
              Talk to your agent. Channel messages can join the same queue.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-muted/20 to-background px-4 py-6 sm:px-6"
            >
              {lines.length === 0 ? (
                <div className="flex h-full min-h-80 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <div className="flex size-12 items-center justify-center rounded-2xl border bg-background shadow-sm">
                    <SparklesIcon className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      Start a conversation
                    </p>
                    <p className="text-sm">
                      Ask your agent to plan, research, or use connected tools.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end gap-5">
                  {lines.map((line) => (
                    <ChatBubble
                      key={line.id}
                      line={line}
                      agentName={props.agentName}
                    />
                  ))}
                </div>
              )}
            </div>

            {props.session?.running &&
            todos?.visible &&
            todos.todos.length > 0 ? (
              <div className="border-t bg-muted/30 p-3 sm:p-4">
                <TodoPanel todos={todos.todos} />
              </div>
            ) : null}

            {props.session?.approvals ? (
              <div className="border-t bg-muted/30 p-3 sm:p-4">
                <ApprovalCard
                  request={props.session.approvals}
                  onApprove={props.onApprove}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="shrink-0 py-0">
          <CardContent className="flex flex-col gap-2 p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
              <Textarea
                ref={textareaRef}
                rows={1}
                className="max-h-14 min-h-9 resize-none overflow-y-hidden"
                value={props.input}
                placeholder={
                  props.session?.running
                    ? "Type a message to queue after the current turn"
                    : "Type a message"
                }
                onChange={(event) => props.setInput(event.target.value)}
                onPaste={(event: ClipboardEvent<HTMLTextAreaElement>) => {
                  const files = filesFromClipboard(event.clipboardData);
                  if (files.length === 0) {
                    return;
                  }
                  event.preventDefault();
                  if (props.uploadingAttachments) {
                    return;
                  }
                  void props.onAddAttachments(files);
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.metaKey
                  ) {
                    event.preventDefault();
                    void props.onSubmit();
                  }
                }}
              />
              <Button
                aria-label={
                  props.session?.running
                    ? "Stop current turn"
                    : props.uploadingAttachments
                      ? "Uploading"
                      : "Send message"
                }
                disabled={!props.session?.running && !canSend}
                size="icon"
                className="h-full min-h-9 max-h-14 w-auto shrink-0 aspect-square"
                variant={props.session?.running ? "outline" : "default"}
                onClick={
                  props.session?.running ? props.onCancel : props.onSubmit
                }
              >
                {props.session?.running ? (
                  <SquareIcon className="size-4" />
                ) : props.uploadingAttachments ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SendIcon className="size-4" />
                )}
              </Button>
            </div>
            <AttachmentDropzone
              attachments={props.attachments}
              uploading={props.uploadingAttachments}
              onAdd={props.onAddAttachments}
              onRemove={props.onRemoveAttachment}
            />
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {props.session?.models.length ? (
                  <Select
                    value={props.session.model}
                    disabled={props.session.running}
                    onValueChange={(value) => void props.onSetModel(value)}
                  >
                    <SelectTrigger className="max-w-[28rem]">
                      <SelectValue placeholder="Choose model">
                        {modelSelectTriggerLabel(
                          props.session.models,
                          props.session.model,
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {props.session.models.map((entry) => (
                          <SelectItem key={entry.name} value={entry.name}>
                            {entry.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : null}
                <Select
                  value={props.sessionMode}
                  disabled={!props.session || props.session.running}
                  onValueChange={(value) =>
                    void props.onSetSessionMode(value as ChatSessionMode)
                  }
                >
                  <SelectTrigger className="min-w-[9rem]">
                    <SelectValue placeholder="Mode">
                      {modeSelectTriggerLabel(props.sessionMode)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="plan">Plan</SelectItem>
                      <SelectItem value="ask">Ask</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select
                  value={props.yolo ? "on" : "off"}
                  disabled={!props.session || props.session.running}
                  onValueChange={(value) =>
                    void props.onSetYolo(value === "on")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Yolo">
                      {props.yolo ? "Yolo · On" : "Yolo · Off"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="on">On</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-2 flex-1" aria-hidden />
              <div className="shrink-0">
                <ChatStatusBlip status={props.session?.status ?? "ready"} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
          <CardDescription>
            Channel messages join the same agent queue as chat.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Channels</p>
              <p className="text-xs text-muted-foreground">
                Receive events from channels.
              </p>
            </div>
            <Switch
              checked={props.daemon?.enabled ?? false}
              onCheckedChange={(checked) => void props.onToggleDaemon(checked)}
            />
          </div>
          <Separator />
          <StatusRow
            label="Pending messages"
            value={String(props.daemon?.queued ?? 0)}
          />
          <StatusRow
            label="Channel messages handled"
            value={String(props.daemon?.processed ?? 0)}
          />
          <StatusRow
            label="Subscriptions"
            value={String(props.daemon?.subscriptions.length ?? 0)}
          />
          {props.daemon?.lastError ? (
            <Alert variant="destructive">
              <AlertTitle>Channel error</AlertTitle>
              <AlertDescription>{props.daemon.lastError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** Pasted screenshots and images expose `File`s via DataTransferItem; some UIs only populate `files`. */
function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) {
    return [];
  }
  const fromItems: File[] = [];
  if (data.items) {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (item.kind !== "file") {
        continue;
      }
      const file = item.getAsFile();
      if (file) {
        fromItems.push(file);
      }
    }
  }
  if (fromItems.length > 0) {
    return fromItems;
  }
  return data.files?.length ? Array.from(data.files) : [];
}

function AttachmentDropzone(props: {
  attachments: UploadedAttachment[];
  uploading: boolean;
  onAdd: (files: File[]) => Promise<void>;
  onRemove: (name: string) => void;
}) {
  const [dragging, setDragging] = useState(false);

  function filesFromList(fileList: FileList | null): File[] {
    return fileList ? Array.from(fileList) : [];
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = filesFromList(event.target.files);
    event.target.value = "";
    void props.onAdd(files);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void props.onAdd(filesFromList(event.dataTransfer.files));
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        className={cn(
          "flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/20 px-2.5 py-1.5 text-sm transition-colors",
          dragging ? "border-primary bg-primary/10" : "hover:bg-muted/40",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background">
            {props.uploading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <UploadIcon className="size-4" />
            )}
          </span>
          <span className="min-w-0 text-left">
            <span className="block text-xs font-medium">
              {props.uploading ? "Uploading attachments" : "Add attachments"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              Drop files here, paste in the message box, or click to choose.
            </span>
          </span>
        </span>
        <input
          className="hidden"
          type="file"
          multiple
          disabled={props.uploading}
          onChange={onInputChange}
        />
      </label>
      {props.attachments.length > 0 ? (
        <AttachmentPreviewList
          attachments={props.attachments}
          onRemove={props.onRemove}
        />
      ) : null}
    </div>
  );
}

function AttachmentPreviewList(props: {
  attachments: AttachmentPreview[];
  onRemove?: (name: string) => void;
  variant?: "default" | "user";
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.attachments.map((attachment) => {
        const label = attachment.originalName ?? attachment.name;
        const isImage = isImageAttachment(attachment);
        return (
          <div
            key={attachment.name}
            className={cn(
              "group relative flex max-w-48 items-center gap-2 rounded-lg border p-1.5 text-xs",
              props.variant === "user"
                ? "border-primary-foreground/15 bg-primary-foreground/10 text-primary-foreground"
                : "bg-background",
            )}
          >
            {isImage ? (
              <span
                className={cn(
                  "flex size-10 shrink-0 overflow-hidden rounded-md",
                  props.variant === "user"
                    ? "bg-primary-foreground/15"
                    : "bg-muted",
                )}
              >
                <img
                  alt={label}
                  className="size-full object-cover"
                  src={attachmentPreviewUrl(attachment.name)}
                />
              </span>
            ) : (
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-md",
                  props.variant === "user"
                    ? "bg-primary-foreground/15 text-primary-foreground/75"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <FileTextIcon />
              </span>
            )}
            <span className="min-w-0 truncate">{label}</span>
            {props.onRemove ? (
              <Button
                size="icon-xs"
                variant="ghost"
                type="button"
                onClick={() => props.onRemove?.(attachment.name)}
                aria-label={`Remove ${label}`}
              >
                <XIcon />
              </Button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ChatStatusBlip({ status }: { status: string }) {
  const mode =
    status === "streaming"
      ? "response"
      : status === "ready"
        ? "idle"
        : "thinking";
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium",
        mode === "idle" && "bg-muted text-muted-foreground",
        mode === "thinking" && "bg-blue-500/10 text-blue-500",
        mode === "response" && "bg-emerald-500/10 text-emerald-500",
      )}
    >
      <span className="relative flex size-2.5">
        {mode !== "idle" ? (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-60",
              mode === "thinking" ? "bg-blue-500" : "bg-emerald-500",
            )}
          />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-2.5 rounded-full",
            mode === "idle" && "bg-muted-foreground/60",
            mode === "thinking" && "bg-blue-500",
            mode === "response" && "bg-emerald-500",
          )}
        />
      </span>
      <span>{mode === "idle" ? "idle" : mode}</span>
    </div>
  );
}

function ChatBubble({
  line,
  agentName,
}: {
  line: ChatLine;
  agentName: string;
}) {
  const isUser = line.role === "user";
  const isAssistant = line.role === "assistant";
  const isTool = line.role === "tool";
  const headerIcon = !isTool && !line.done;
  const resolvedToolName = line.toolName ?? line.title;
  const label = isTool
    ? `Tool - ${resolvedToolName ?? "unknown"}`
    : isAssistant
      ? agentName
      : (line.toolName ?? line.title ?? line.role);
  const userContent = isUser
    ? parseMessageAttachments(line.content)
    : { text: line.content, attachments: [] };
  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "group max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm",
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : isTool
              ? "rounded-bl-md bg-card"
              : "rounded-bl-md bg-card",
        )}
      >
        {!isUser ? (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            {headerIcon ? (
              <span className="flex size-5 items-center justify-center rounded-full border bg-background">
                <Loader2Icon className="size-3 animate-spin" />
              </span>
            ) : null}
            <span className="font-medium">{label}</span>
            {!line.done ? <span>running</span> : null}
          </div>
        ) : null}

        {line.reasoningContent ? (
          <details
            className="group mb-3 rounded-xl bg-muted/30 px-3 py-2"
            open={!line.done}
          >
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
              <span>Reasoning</span>
              <ChevronDownIcon className="size-3 group-open:hidden" />
              <ChevronUpIcon className="hidden size-3 group-open:block" />
            </summary>
            <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
              {line.reasoningContent}
            </pre>
          </details>
        ) : null}

        {isAssistant ? (
          line.content ? (
            <MarkdownContent content={line.content} />
          ) : !line.done ? (
            <AssistantResponseSkeleton />
          ) : (
            <MarkdownContent content="(empty)" />
          )
        ) : isTool ? (
          <ToolArgumentsDisclosure content={line.content} />
        ) : (
          <div className="flex flex-col gap-3">
            {userContent.text ? (
              <pre className="whitespace-pre-wrap font-sans">
                {userContent.text}
              </pre>
            ) : null}
            {userContent.attachments.length > 0 ? (
              <AttachmentPreviewList
                attachments={userContent.attachments}
                variant="user"
              />
            ) : null}
            {!userContent.text && userContent.attachments.length === 0 ? (
              <pre className="whitespace-pre-wrap font-sans">(empty)</pre>
            ) : null}
          </div>
        )}

        {line.fileToolDisplay ? (
          <FileDiffPreview display={line.fileToolDisplay} />
        ) : null}

        {line.resultContent ? (
          <details className="group mt-3 rounded-xl bg-muted/30 px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
              <span>Result</span>
              <ChevronDownIcon className="size-3 group-open:hidden" />
              <ChevronUpIcon className="hidden size-3 group-open:block" />
            </summary>
            <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
              {line.resultContent}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function AssistantResponseSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-4 w-40" />
    </div>
  );
}

function ToolArgumentsDisclosure({ content }: { content: string }) {
  return (
    <details className="group rounded-xl bg-muted/30 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span>Parameters</span>
        <ChevronDownIcon className="size-3 group-open:hidden" />
        <ChevronUpIcon className="hidden size-3 group-open:block" />
      </summary>
      <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
        {content || "(empty)"}
      </pre>
    </details>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:overflow-auto prose-pre:rounded-md prose-pre:bg-muted prose-pre:p-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function DiffBlock({ lines }: { lines: string[] }) {
  return (
    <pre className="max-h-52 overflow-auto rounded-md bg-background/70 p-2 font-mono text-xs">
      {lines.map((line, index) => {
        const added = line.startsWith("+") && !line.startsWith("+++");
        const removed = line.startsWith("-") && !line.startsWith("---");
        return (
          <div
            key={`${index}-${line}`}
            className={cn(
              "min-h-5 whitespace-pre-wrap px-1",
              added && "bg-emerald-500/10 text-emerald-500",
              removed && "bg-red-500/10 text-red-500",
              !added && !removed && "text-muted-foreground",
            )}
          >
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

function FileDiffPreview({
  display,
}: {
  display: NonNullable<ChatLine["fileToolDisplay"]>;
}) {
  return (
    <details className="group mt-3 rounded-xl bg-muted/30 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span>Changes</span>
        <ChevronDownIcon className="size-3 group-open:hidden" />
        <ChevronUpIcon className="hidden size-3 group-open:block" />
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        {display.previews?.map((preview, index) => (
          <DiffBlock key={`preview-${index}`} lines={preview.split("\n")} />
        ))}
        {display.structuredPatch?.map((hunk, index) => (
          <DiffBlock key={`hunk-${index}`} lines={hunk.lines} />
        ))}
      </div>
    </details>
  );
}

function todoStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    default:
      return status
        .split("_")
        .filter(Boolean)
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" ");
  }
}

function todoStatusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "border-amber-500/35 bg-amber-500/[0.13] text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100";
    case "in_progress":
      return "border-sky-500/35 bg-sky-500/[0.13] text-sky-950 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-100";
    case "completed":
      return "border-emerald-500/35 bg-emerald-500/[0.13] text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100";
    default:
      return "border-border bg-muted/80 text-muted-foreground";
  }
}

function TodoPanel({
  todos,
}: {
  todos: Array<{ content: string; status: string; activeForm: string }>;
}) {
  const completed = todos.filter((t) => t.status === "completed").length;
  const summary =
    completed === todos.length
      ? `${todos.length} done`
      : `${completed}/${todos.length} done`;

  return (
    <Card className="mx-auto w-full max-w-3xl py-0 shadow-sm">
      <CardHeader className="space-y-1 pb-2 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ClipboardListIcon className="size-4 shrink-0 text-muted-foreground" />
            Todos
          </CardTitle>
          <Badge variant="secondary" className="font-mono text-xs font-normal">
            {summary}
          </Badge>
        </div>
        <CardDescription className="text-xs leading-snug">
          Current agent task list for this turn.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <div className="rounded-lg bg-muted/30 p-2">
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">
            Tasks
          </div>
          <ul className="max-h-52 divide-y divide-border/60 overflow-y-auto">
            {todos.map((todo, index) => (
              <li
                key={`${todo.content}-${index}`}
                className="flex gap-2 py-2 first:pt-0 last:pb-0"
              >
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 shrink-0 self-center px-1.5 text-[10px] font-medium tracking-tight",
                    todoStatusBadgeClass(todo.status),
                  )}
                >
                  {todoStatusLabel(todo.status)}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">
                    {todo.activeForm || todo.content}
                  </p>
                  {todo.activeForm && todo.activeForm !== todo.content ? (
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {todo.content}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function ApprovalCard(props: {
  request: NonNullable<ChatSessionSnapshot["approvals"]>;
  onApprove: (decision: "allow" | "always" | "deny") => Promise<void>;
}) {
  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <WrenchIcon className="size-4 text-muted-foreground" />
            Tool approval required
          </CardTitle>
          <Badge variant="secondary">{props.request.toolName}</Badge>
        </div>
        {props.request.description ? (
          <CardDescription className="line-clamp-2">
            {props.request.description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="rounded-lg bg-muted/30 p-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Parameters
          </div>
          <pre className="max-h-20 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
            {props.request.inputPreview}
          </pre>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" onClick={() => void props.onApprove("allow")}>
            Allow once
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void props.onApprove("always")}
          >
            Always allow
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void props.onApprove("deny")}
          >
            Deny
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
