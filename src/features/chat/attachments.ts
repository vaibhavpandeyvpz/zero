export type AttachmentPreview = {
  name: string;
  originalName?: string;
  mimeType?: string;
};

const IMAGE_ATTACHMENT_EXTENSIONS = new Set([
  ".apng",
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

export function attachmentPreviewUrl(name: string): string {
  return `/api/attachments/${encodeURIComponent(name)}/thumbnail`;
}

export function isImageAttachment(attachment: AttachmentPreview): boolean {
  if (attachment.mimeType?.startsWith("image/")) {
    return true;
  }
  const extension = attachment.name
    .slice(attachment.name.lastIndexOf("."))
    .toLowerCase();
  return IMAGE_ATTACHMENT_EXTENSIONS.has(extension);
}

export function parseMessageAttachments(content: string): {
  text: string;
  attachments: AttachmentPreview[];
} {
  const attachments: AttachmentPreview[] = [];
  const textLines: string[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^\[attachment\]\s+(.+)$/);
    if (match) {
      attachments.push({ name: match[1].trim() });
    } else {
      textLines.push(line);
    }
  }
  const text = textLines.join("\n").trim();
  return {
    text: text === "[attachments]" ? "" : text,
    attachments,
  };
}
