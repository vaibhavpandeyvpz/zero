"use client";

import { useState } from "react";
import { HistoryIcon, MessageSquareIcon, Trash2Icon } from "lucide-react";
import type { ChatSessionSummary } from "@/client/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RELATIVE_TIME_UNITS: Array<{
  unit: Intl.RelativeTimeFormatUnit;
  ms: number;
}> = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const diffMs = date.getTime() - Date.now();
  for (const { unit, ms } of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffMs) >= ms) {
      return relativeTimeFormatter.format(Math.round(diffMs / ms), unit);
    }
  }
  return relativeTimeFormatter.format(Math.round(diffMs / 1000), "second");
}

export function SessionSwitcher(props: {
  sessions: ChatSessionSummary[];
  currentSessionId: string;
  loading: boolean;
  onOpen: () => void;
  onSwitch: (sessionId: string) => void;
  onDelete: (sessionId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          props.onOpen();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HistoryIcon />
          Resume chat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chat sessions</DialogTitle>
          <DialogDescription>
            Resume a previous conversation — its full history, tool calls, and
            settings pick up right where you left off.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 max-h-96 overflow-y-auto px-1">
          {props.loading && props.sessions.length === 0 ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : props.sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <MessageSquareIcon className="size-6" />
              <p className="text-sm">No saved sessions yet.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {props.sessions.map((entry) => {
                const isCurrent = entry.sessionId === props.currentSessionId;
                return (
                  <li key={entry.sessionId}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-current={isCurrent}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60",
                        isCurrent
                          ? "border-primary/40 bg-primary/5"
                          : "border-transparent bg-muted/30",
                      )}
                      onClick={() => {
                        if (!isCurrent) {
                          props.onSwitch(entry.sessionId);
                          setOpen(false);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (
                          !isCurrent &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          props.onSwitch(entry.sessionId);
                          setOpen(false);
                        }
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {entry.title}
                          </p>
                          {isCurrent ? (
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-[10px]"
                            >
                              Current
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {formatRelativeTime(entry.updatedAt)} ·{" "}
                          {entry.messageCount}{" "}
                          {entry.messageCount === 1 ? "message" : "messages"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete session "${entry.title}"`}
                        disabled={deletingId === entry.sessionId}
                        onClick={async (event) => {
                          event.stopPropagation();
                          setDeletingId(entry.sessionId);
                          await props.onDelete(entry.sessionId);
                          setDeletingId(null);
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
