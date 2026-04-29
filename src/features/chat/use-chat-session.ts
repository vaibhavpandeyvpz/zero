import { useState } from "react";
import { toast } from "sonner";
import {
  cancelChat,
  decideApproval,
  streamMessage,
  uploadAttachments,
} from "@/client/api";
import type {
  ChatSessionSnapshot,
  UploadedAttachment,
} from "@/client/types";
import { applyChatEvent, newSessionId } from "./session-state";

export function useChatSession() {
  const [sessionId] = useState(newSessionId);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [session, setSession] = useState<ChatSessionSnapshot | null>(null);

  async function submitMessage() {
    const text = input.trim();
    if (uploadingAttachments) {
      toast.info("Attachment upload is still in progress.");
      return;
    }
    const attachmentNames = attachments.map((attachment) => attachment.name);
    if (!text && attachmentNames.length === 0) return;
    const previous = attachments;
    setInput("");
    setAttachments([]);
    try {
      await streamMessage({ sessionId, text, attachments: attachmentNames }, (event) => {
        setSession((current) => applyChatEvent(current, sessionId, event));
      });
    } catch (error) {
      setInput(text);
      setAttachments(previous);
      toast.error((error as Error).message);
    }
  }

  async function addAttachmentFiles(files: File[]) {
    if (files.length === 0) return;
    setUploadingAttachments(true);
    try {
      const data = await uploadAttachments(files);
      setAttachments((current) => [...current, ...data.attachments]);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploadingAttachments(false);
    }
  }

  function removeAttachment(name: string) {
    setAttachments((current) =>
      current.filter((attachment) => attachment.name !== name),
    );
  }

  async function cancel() {
    try {
      const data = await cancelChat(sessionId);
      setSession(data.session);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function approve(decision: "allow" | "always" | "deny") {
    try {
      const data = await decideApproval(sessionId, decision);
      setSession(data.session);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return {
    sessionId,
    input,
    setInput,
    attachments,
    uploadingAttachments,
    session,
    submitMessage,
    addAttachmentFiles,
    removeAttachment,
    cancel,
    approve,
  };
}
